package main

import (
	"compress/bzip2"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/kjk/u"
)

type SimpleNoteTest struct {
	ID               string      `json:"id"`
	Version          int         `json:"v"`
	IsDeleted        interface{} `json:"deleted"` // bool or int
	Content          string      `json:"content"`
	Tags             []string    `json:"tags"`
	ModificationDate float64     `json:"modificationDate"`
	CreationDate     float64     `json:"creationDate"`
}

var (
	simpleNoteNotes []*SimpleNoteTest
)

func loadSimpleNotes() []*SimpleNoteTest {
	if simpleNoteNotes != nil {
		return simpleNoteNotes
	}
	path := filepath.Join("data", "notes.json.bz2")
	f, err := os.Open(path)
	u.PanicIfErr(err)
	defer f.Close()
	latestVersions := make(map[string]*SimpleNoteTest)
	bzr := bzip2.NewReader(f)
	dec := json.NewDecoder(bzr)
	for {
		var v SimpleNoteTest
		err = dec.Decode(&v)
		if err == io.EOF {
			break
		}
		u.PanicIfErr(err)
		currVal := latestVersions[v.ID]
		if currVal == nil || v.Version > currVal.Version {
			latestVersions[v.ID] = &v
		}
	}
	var res []*SimpleNoteTest
	for _, v := range latestVersions {
		res = append(res, v)
	}
	simpleNoteNotes = res
	return res
}

func TestSearch(t *testing.T) {
	notes := loadSimpleNotes()
	fmt.Printf("%d simple note notes\n", len(notes))
}
