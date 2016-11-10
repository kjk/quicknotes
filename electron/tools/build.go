package main

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"

	"io/ioutil"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

const (
	s3Bucket = "kjkpub"
	s3Prefix = "software/quicknotes/"
	//s3Prefix     = "software/dbhero/"
	s3PathRel    = s3Prefix + "rel/"
	s3PathRelMac = s3PathRel + "mac/"
)

var (
	svc = s3.New(session.New(&aws.Config{Region: aws.String("us-east-1")}))
)

/*
s3 urls:
kjkpub/software/quicknotes/
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

func checkStringNotInArray(a []string, s string) {
	panicIf(stringInArray(a, s), fmt.Sprintf("%s already in %s", s, a))
}

func checkNotExistsInS3Mac(version string) {
	s3PathMacZip := fmt.Sprintf("%sQuickNotes-%s.zip", s3PathRelMac, version)
	s3PathMacDmg := fmt.Sprintf("%sQuickNotes-%s.dmg", s3PathRelMac, version)
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
	fmt.Printf("files: %s\n", s3Files)
	checkStringNotInArray(s3Files, s3PathMacZip)
	checkStringNotInArray(s3Files, s3PathMacDmg)
}

func checkNotExistsInS3(version string) {
	if isMac() {
		checkNotExistsInS3Mac(version)
	} else {
		panicIf(true, "only mac supported for now")
	}
}

func main() {
	version := getVersion()
	fmt.Printf("Version: %s\n", version)
	checkNotExistsInS3(version)
}
