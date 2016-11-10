package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"time"

	"io/ioutil"

	"os/exec"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

/*
s3 urls in bucket kjkpub:
software/quicknotes/
  lastvermac.js
  lastverwin.js
  rel/
    mac/
      QuickNotes-${ver}.zip
      QuickNotes-${ver}.dmg
    win/
      QuickNotes-32-${ver}.exe
      QuickNotes-64-${ver}.exe
*/

const (
	s3Bucket = "kjkpub"
	s3Prefix = "software/quicknotes/"
	//s3Prefix     = "software/dbhero/"
	s3PathRel          = s3Prefix + "rel/"
	s3PathRelMac       = s3PathRel + "mac/"
	s3PathLatestVerMac = s3Prefix + "lastvermac.js"
	s3PathLatestVerWin = s3Prefix + "lastverwin.js"
)

var (
	s3PathMacZip string
	s3PathMacDmg string
	pathMacZip   string
	pathMacDmg   string
)

func buildPaths(version string) {
	s3PathMacZip = fmt.Sprintf("%sQuickNotes-%s.zip", s3PathRelMac, version)
	s3PathMacDmg = fmt.Sprintf("%sQuickNotes-%s.dmg", s3PathRelMac, version)
	pathMacZip = fmt.Sprintf("dist/mac/QuickNotes-%s-mac.zip", version)
	pathMacDmg = fmt.Sprintf("dist/mac/QuickNotes-%s.dmg", version)
}

var (
	svc = s3.New(session.New(&aws.Config{Region: aws.String("us-east-1")}))
)

func isMac() bool { return runtime.GOOS == "darwin" }

func isWin() bool { return runtime.GOOS == "windows" }

func panicIfErr(err error) {
	if err != nil {
		panic(err)
	}
}

func panicIf(cond bool, msg string) {
	if cond {
		panic(msg)
	}
}

func checkFileExists(path string) {
	_, err := os.Stat(path)
	panicIfErr(err)
}

func getVersion() string {
	d, err := ioutil.ReadFile("package.json")
	panicIfErr(err)
	var o = struct {
		Version string `json:"version"`
	}{}
	err = json.Unmarshal(d, &o)
	panicIfErr(err)
	return o.Version
}

func stringInArray(a []string, s string) bool {
	for _, s2 := range a {
		if s == s2 {
			return true
		}
	}
	return false
}

func checkNotInS3(s3Files []string, path string) {
	if stringInArray(s3Files, path) {
		fmt.Printf("%s already in s3\n", path)
		os.Exit(1)
	}
}

func checkNotExistsInS3Mac() {
	params := &s3.ListObjectsV2Input{
		// Delimiter: '/',
		Prefix: aws.String(s3Prefix),
		Bucket: aws.String("kjkpub"),
	}
	var s3Files []string
	err := svc.ListObjectsV2Pages(params,
		func(page *s3.ListObjectsV2Output, lastPage bool) bool {
			files := page.Contents
			for _, f := range files {
				key := *f.Key
				s3Files = append(s3Files, key)
			}
			return true
		})
	panicIfErr(err)
	checkNotInS3(s3Files, s3PathMacZip)
	checkNotInS3(s3Files, s3PathMacDmg)
}

func checkNotExistsInS3() {
	if isMac() {
		checkNotExistsInS3Mac()
	} else {
		panicIf(true, "only mac supported for now")
	}
}

func s3UploadFilePublic(s3Path, localPath, contentType string) {
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	fmt.Printf("Uploading '%s' as '%s'...", localPath, s3Path)
	timeStart := time.Now()
	r, err := os.Open(localPath)
	panicIfErr(err)
	defer r.Close()
	params := &s3.PutObjectInput{
		Bucket:      aws.String("kjkpub"),
		Key:         aws.String(s3Path),
		ACL:         aws.String(s3.ObjectCannedACLPublicRead),
		Body:        r,
		ContentType: aws.String(contentType),
	}
	_, err = svc.PutObject(params)
	panicIfErr(err)
	fmt.Printf(" took %s\n", time.Since(timeStart))
}

func s3UploadDataPublic(s3Path string, data []byte, contentType string) {
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	r := bytes.NewReader(data)
	params := &s3.PutObjectInput{
		Bucket:      aws.String("kjkpub"),
		Key:         aws.String(s3Path),
		ACL:         aws.String(s3.ObjectCannedACLPublicRead),
		Body:        r,
		ContentType: aws.String(contentType),
	}
	_, err := svc.PutObject(params)
	panicIfErr(err)
}

func s3UploadMac(version string) {
	s3UploadFilePublic(s3PathMacZip, pathMacZip, "")
	s3UploadFilePublic(s3PathMacDmg, pathMacDmg, "")
	var urlPrefix = "https://s3.amazonaws.com/kjkpub/"
	var o = struct {
		Ver       string `json:"ver"`
		MacZipURL string `json:"macZipUrl"`
		MacDmgURL string `json:"macDmgUrl"`
	}{
		Ver:       version,
		MacZipURL: urlPrefix + s3PathMacZip,
		MacDmgURL: urlPrefix + s3PathMacDmg,
	}
	d, err := json.MarshalIndent(o, "", "  ")
	panicIfErr(err)
	s3UploadDataPublic(s3PathLatestVerMac, d, "application/json")
}

func s3Upload(version string) {
	if isMac() {
		s3UploadMac(version)
	} else {
		panicIf(true, "only mac supported")
	}
}

func main() {
	version := getVersion()
	fmt.Printf("Version: %s\n", version)
	buildPaths(version)
	checkNotExistsInS3()
	fmt.Printf("building the application...")
	timeStart := time.Now()
	cmd := exec.Command("./node_modules/.bin/build")
	d, err := cmd.CombinedOutput()
	fmt.Printf(" took %s\nOutput:\n%s\n", time.Since(timeStart), string(d))
	panicIfErr(err)
	s3Upload(version)
}
