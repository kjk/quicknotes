package main

import (
	"compress/bzip2"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"time"
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
	PanicIfErr(err)
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
		PanicIfErr(err)
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

func sprintNoteID(noteID string, shown *bool) string {
	if *shown {
		return ""
	}
	*shown = true
	return fmt.Sprintf("\nNote id: %s\n", noteID)
}

func noteMatchToString2(term, title, body, noteID string, match *Match) string {
	shownID := false
	var res string
	if len(match.titleMatchPos) > 0 {
		res += sprintNoteID(noteID, &shownID)
		s := decorate(title, match.titleMatchPos)
		res += fmt.Sprintf("Title: %s\n", s)
	}
	if len(match.bodyMatchPos) > 0 {
		res += sprintNoteID(noteID, &shownID)
		lineMatches := matchToLines([]byte(body), match.bodyMatchPos)
		lineMatches = collapseSameLines(lineMatches)
		for _, lm := range lineMatches {
			s := decorate(lm.line, lm.matches)
			s = trimSpaceLineRight(s)
			res += fmt.Sprintf("%d: %s\n", lm.lineNo+1, s)
		}
	}

	//res += fmt.Sprintf("title matches: %d %v\n", len(match.titleMatchPos), match.titleMatchPos)
	//res += fmt.Sprintf("body  matches: %d %v\n", len(match.bodyMatchPos), match.bodyMatchPos)
	//res += fmt.Sprintf("total matches: %d\n", len(match.titleMatchPos)+len(match.bodyMatchPos))

	return res
}

func noteMatchToString(term string, match *Match) string {
	n := match.note
	title := n.Title
	body := n.Content()
	noteID := n.HashID
	return noteMatchToString2(term, title, body, noteID, match)
}

func printSearchResults(term string, matches []*MatchWithSimpleNote) {
	fmt.Printf("%d matches for '%s'\n", len(matches), term)
	for _, m := range matches {
		s := noteMatchToString2(term, m.title, m.body, m.note.ID, m.match)
		fmt.Printf("%s\n", s)
	}
}

func searchAllNotesTest(term string, maxResults int) {
	timeStart := time.Now()
	notes, err := dbGetAllNotes()
	PanicIfErr(err)
	fmt.Printf("got %d notes in %s\n", len(notes), time.Since(timeStart))

	timeStart = time.Now()

	matches := searchNotes(term, notes, maxResults)
	for _, match := range matches {
		fmt.Print(noteMatchToString(term, match))
	}
	fmt.Printf("found %d matching notes in %s\n", len(matches), time.Since(timeStart))
}

// Maybe: combine with searchNotes by using interfaces to
// abstract Note
func searchSimpleNotes(term string, maxResults int) []*MatchWithSimpleNote {
	terms := splitTerm(term)
	if len(terms) == 0 {
		return nil
	}
	notes := loadSimpleNotes()
	var matches []*MatchWithSimpleNote
	for _, note := range notes {
		var res *Match
		title, bodyBytes := noteToTitleContent([]byte(note.Content))
		body := string(bodyBytes)
		for _, term := range terms {
			match := searchTitleAndBody(term, title, body, 16)
			if match == nil {
				res = nil
				break
			}
			if res == nil {
				res = match
			} else {
				appendMatch(res, match)
			}
		}
		if res == nil {
			continue
		}
		sortMatchPositions(res)
		m := &MatchWithSimpleNote{
			match: res,
			note:  note,
			title: title,
			body:  body,
		}
		res.note = &Note{}
		res.note.Title = title
		matches = append(matches, m)
		if maxResults != -1 && len(matches) >= maxResults {
			break
		}
	}
	sort.Sort(BySimpleMatchScore(matches))
	return matches
}

func searchLocalNotes(term string, maxResults int) {
	matches := searchSimpleNotes(term, maxResults)
	printSearchResults(term, matches)
}
