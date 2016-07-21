package main

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

const hdr = `// +build embeded_resources

package main

var resourcesZipData = []byte{
`

func printStack() {
	buf := make([]byte, 1024*164)
	n := runtime.Stack(buf, false)
	fmt.Printf("%s", buf[:n])
}

func fatalf(format string, args ...interface{}) {
	fmt.Printf(format, args...)
	printStack()
	os.Exit(1)
}

var (
	inFatal bool
)

func fatalif(cond bool, format string, args ...interface{}) {
	if cond {
		if inFatal {
			os.Exit(1)
		}
		inFatal = true
		fmt.Printf(format, args...)
		printStack()
		os.Exit(1)
	}
}
func fataliferr(err error) {
	if err != nil {
		fatalf("%s\n", err.Error())
	}
}

func hasAnySuffix(s string, suffixes []string) bool {
	s = strings.ToLower(s)
	for _, suff := range suffixes {
		if strings.HasSuffix(s, suff) {
			return true
		}
	}
	return false
}

func isBlacklisted(path string) bool {
	// filter out all .css files other than main.css
	if strings.HasSuffix(path, ".css") {
		if !strings.HasSuffix(path, "main.css") {
			return true
		}
	}
	toExcludeSuffix := []string{".map", ".gitkeep", "test.html", "test2.html"}
	return hasAnySuffix(path, toExcludeSuffix)
}

func shouldAddCompressed(path string) bool {
	toCompressSuffix := []string{".js", ".css", ".html"}
	return hasAnySuffix(path, toCompressSuffix)
}

func zipNameConvert(s string) string {
	conversions := []string{"s/dist/bundle.min.js", "s/dist/bundle.js"}
	n := len(conversions) / 2
	for i := 0; i < n; i++ {
		if conversions[i*2] == s {
			return conversions[i*2+1]
		}
	}
	return s
}

func zipFileName(path, baseDir string) string {
	fatalif(!strings.HasPrefix(path, baseDir), "'%s' doesn't start with '%s'", path, baseDir)
	n := len(baseDir)
	path = path[n:]
	if path[0] == '/' || path[0] == '\\' {
		path = path[1:]
	}
	// always use unix path separator inside zip files because that's what
	// the browser uses in url and we must match that
	return strings.Replace(path, "\\", "/", -1)
}

func cmdToStr(cmd *exec.Cmd) string {
	s := filepath.Base(cmd.Path)
	arr := []string{s}
	arr = append(arr, cmd.Args...)
	return strings.Join(arr, " ")
}

func getCmdOut(cmd *exec.Cmd) []byte {
	cmd.Stdout = &bytes.Buffer{}
	cmd.Stderr = &bytes.Buffer{}
	err := cmd.Start()
	if err != nil {
		return nil
	}
	err = cmd.Wait()
	if err != nil {
		return nil
	}
	resErr := cmd.Stdout.(*bytes.Buffer).Bytes()
	if len(resErr) != 0 {
		return nil
	}
	return cmd.Stdout.(*bytes.Buffer).Bytes()
}

func compressFileMust(path string) []byte {
	cmd := exec.Command("zopfli", "-c", path)
	d := getCmdOut(cmd)
	if len(d) > 0 {
		return d
	}
	out := &bytes.Buffer{}
	content, err := ioutil.ReadFile(path)
	fataliferr(err)
	w, err := gzip.NewWriterLevel(out, gzip.BestCompression)
	fataliferr(err)
	_, err = w.Write(content)
	fataliferr(err)
	err = w.Close()
	fataliferr(err)
	return out.Bytes()
}

func checkZopfliInstalled() {
	_, err := exec.LookPath("zopfli")
	if err != nil {
		fmt.Printf("'zopfli' doesn't seem to be installed. Use 'brew install zopfli' on mac\n")
	}
}

func addZipFileMust(zw *zip.Writer, path, zipName string) {
	fi, err := os.Stat(path)
	fataliferr(err)
	fmt.Printf("adding '%s' (%d bytes) as '%s'\n", path, fi.Size(), zipName)
	fih, err := zip.FileInfoHeader(fi)
	fataliferr(err)
	fih.Name = zipName
	fih.Method = zip.Deflate
	d, err := ioutil.ReadFile(path)
	fataliferr(err)
	fw, err := zw.CreateHeader(fih)
	fataliferr(err)
	_, err = fw.Write(d)
	fataliferr(err)
	// fw is just a io.Writer so we can't Close() it. It's not necessary as
	// it's implicitly closed by the next Create(), CreateHeader()
	// or Close() call on zip.Writer
}

func addZipDataMust(zw *zip.Writer, path string, d []byte, zipName string) {
	fmt.Printf("adding data (%d bytes) as '%s'\n", len(d), zipName)
	fi, err := os.Stat(path)
	fataliferr(err)
	fih, err := zip.FileInfoHeader(fi)
	fataliferr(err)
	fih.Name = zipName
	fih.Method = zip.Store
	fw, err := zw.CreateHeader(fih)
	fataliferr(err)
	_, err = fw.Write(d)
	fataliferr(err)
	// fw is just a io.Writer so we can't Close() it. It's not necessary as
	// it's implicitly closed by the next Create(), CreateHeader()
	// or Close() call on zip.Writer
}

func addZipDirMust(zw *zip.Writer, dir, baseDir string) {
	dirsToVisit := []string{dir}
	for len(dirsToVisit) > 0 {
		dir = dirsToVisit[0]
		dirsToVisit = dirsToVisit[1:]
		files, err := ioutil.ReadDir(dir)
		fataliferr(err)
		for _, fi := range files {
			name := fi.Name()
			path := filepath.Join(dir, name)
			if fi.IsDir() {
				dirsToVisit = append(dirsToVisit, path)
				continue
			}

			if !fi.Mode().IsRegular() {
				continue
			}
			zipName := zipFileName(path, baseDir)
			zipName = zipNameConvert(zipName)
			if isBlacklisted(path) {
				continue
			}
			addZipFileMust(zw, path, zipName)
			if shouldAddCompressed(path) {
				zipName = zipName + ".gz"
				d := compressFileMust(path)
				addZipDataMust(zw, path, d, zipName)
			}
		}
	}
}

func createResourcesZip(path string) {
	f, err := os.Create(path)
	fataliferr(err)
	defer f.Close()
	zw := zip.NewWriter(f)
	currDir, err := os.Getwd()
	fataliferr(err)
	dir := filepath.Join(currDir, "s")
	addZipDirMust(zw, dir, currDir)
	addZipFileMust(zw, "createdb.sql", "createdb.sql")
	path = filepath.Join(currDir, "data", "welcome.md")
	addZipFileMust(zw, path, "welcome.md")
	err = zw.Close()
	fataliferr(err)
}

func genHexLine(f *os.File, d []byte, off, n int) {
	if n == 0 {
		return
	}
	_, err := f.WriteString("\t")
	fataliferr(err)
	for i := 0; i < n; i++ {
		b := d[off+i]
		_, err = fmt.Fprintf(f, "0x%02x,", b)
		fataliferr(err)
	}
	_, err = f.WriteString("\n")
	fataliferr(err)
}

func genResourcesGo(goPath, dataPath string) {
	d, err := ioutil.ReadFile(dataPath)
	fataliferr(err)
	f, err := os.Create(goPath)
	fataliferr(err)
	defer f.Close()
	f.WriteString(hdr)

	nPerLine := 16
	nFullLines := len(d) / nPerLine
	nLastLine := len(d) % nPerLine
	n := 0
	for i := 0; i < nFullLines; i++ {
		genHexLine(f, d, n, nPerLine)
		n += nPerLine
	}
	genHexLine(f, d, n, nLastLine)
	f.WriteString("}\n")
}

func genResources() {
	zipPath := "quicknotes_resources.zip"
	createResourcesZip(zipPath)
	goPath := "resources.go"
	genResourcesGo(goPath, zipPath)
}

func main() {
	checkZopfliInstalled()
	genResources()
}
