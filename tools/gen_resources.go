package main

import (
	"archive/zip"
	"fmt"
	"io/ioutil"
	"os"
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

func isBlaclisted(path string) bool {
	toExcludeSuffix := []string{".map", ".gitkeep", "test.html", "test2.html"}
	path = strings.ToLower(path)
	for _, suff := range toExcludeSuffix {
		if strings.HasSuffix(path, suff) {
			return true
		}
	}
	return false
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

func addZipFileMust(zw *zip.Writer, path, zipName string) {
	fmt.Printf("adding '%s' as '%s'\n", path, zipName)
	fi, err := os.Stat(path)
	fataliferr(err)
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
			} else if fi.Mode().IsRegular() {
				zipName := zipFileName(path, baseDir)
				zipName = zipNameConvert(zipName)
				if !isBlaclisted(path) {
					addZipFileMust(zw, path, zipName)
				}
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
	err = zw.Close()
	fataliferr(err)
}

func genHexLine(f *os.File, d []byte, off, n int) {
	f.WriteString("\t")
	for i := 0; i < n; i++ {
		b := d[off+i]
		fmt.Fprintf(f, "0x%02x,", b)
	}
	f.WriteString("\n")
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
	genResources()
}
