package main

import (
	"compress/bzip2"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/kjk/u"
)

var (
	simpleNoteNotes []*SimpleNoteTest
)

// SimpleNoteTest describes a simple note
type SimpleNoteTest struct {
	ID               string      `json:"id"`
	Version          int         `json:"v"`
	IsDeleted        interface{} `json:"deleted"` // bool or int
	Content          string      `json:"content"`
	Tags             []string    `json:"tags"`
	ModificationDate float64     `json:"modificationDate"`
	CreationDate     float64     `json:"creationDate"`
}

// MatchWithSimpleNote describes a match with SimpleNote
type MatchWithSimpleNote struct {
	match *Match
	note  *SimpleNoteTest
	title string
	body  string
}

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

func searchSimpleNotes(term string) []*MatchWithSimpleNote {
	notes := loadSimpleNotes()
	var matches []*MatchWithSimpleNote
	for _, note := range notes {
		title, body := noteToTitleContent([]byte(note.Content))
		match := searchTitleAndBody(term, title, string(body))
		if match != nil {
			m := &MatchWithSimpleNote{
				match: match,
				note:  note,
				title: title,
				body:  string(body),
			}
			matches = append(matches, m)
		}
	}
	return matches
}

func printSearchResults(term string, matches []*MatchWithSimpleNote) {
	fmt.Printf("%d matches\n", len(matches))
	for _, m := range matches {
		s := noteMatchToString2(term, m.title, m.body, m.note.ID, m.match)
		fmt.Printf("%s\n", s)
	}
}

func searchLocalNotes(term string) {
	matches := searchSimpleNotes(term)
	printSearchResults(term, matches)
}

func searchAllNotesTest(term string) {
	timeStart := time.Now()
	notes, err := dbGetAllNotes()
	u.PanicIfErr(err)
	fmt.Printf("got %d notes in %s\n", len(notes), time.Since(timeStart))

	timeStart = time.Now()

	matches := searchNotes(term, notes)
	for _, match := range matches {
		fmt.Print(noteMatchToString(term, match))
	}
	fmt.Printf("found %d matching notes in %s\n", len(matches), time.Since(timeStart))
}
