package main

import (
	"bytes"
	"io/ioutil"
	"os"
	"testing"

	"github.com/kjk/log"
)

type ContentId struct {
	sha1 []byte
	path string
}

func TestLocalStore(t *testing.T) {
	if false {
		log.IncVerbosity()
		defer log.DecVerbosity()
	}
	log.LogToStdout = true
	dir := ExpandTildeInPath("~/data/test_localstore")
	os.RemoveAll(dir)
	CreateDirMust(dir)
	store, err := NewLocalStore(dir)
	PanicIfErr(err)
	store.MaxSegmentSize = 8192           // for testing
	store.FileSizeSegmentThreshold = 7000 // localstore.go is bigger than that
	var contentIds []*ContentId
	files, err := ioutil.ReadDir(".")
	PanicIfErr(err)
	for _, fi := range files {
		path := fi.Name()
		if !fi.Mode().IsRegular() {
			continue
		}
		//fmt.Printf("file: %s, size: %d\n", path, fi.Size())
		d, err := ioutil.ReadFile(path)
		PanicIfErr(err)
		sha1, err := store.PutContent(d)
		PanicIfErr(err)
		cid := &ContentId{sha1: sha1, path: path}
		contentIds = append(contentIds, cid)
	}

	for _, cid := range contentIds {
		d, err := store.GetContentBySha1(cid.sha1)
		sha1 := Sha1OfBytes(d)
		if !bytes.Equal(sha1, cid.sha1) {
			t.Fatalf("invalid data for %s, sha1: %x cid.sha1: %x", cid.path, sha1, cid.sha1)
		}
		PanicIfErr(err)
		d2, err := ioutil.ReadFile(cid.path)
		PanicIfErr(err)
		if !bytes.Equal(d, d2) {
			t.Fatalf("invalid data for %s", cid.path)
		}
	}
}
