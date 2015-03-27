package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/kjk/u"
)

const (
	colorReset = "\x1b[0m\x1b[K"
	colorMatch = "\x1b[30;43m" // black text with yellow background
)

var (
	flgPositions bool
)

// Match describes matches in the note
type Match struct {
	note          *Note
	titleMatchPos []int
	bodyMatchPos  []int
}

func decorate(s string, termLen int, matchPositions []int) string {
	if len(matchPositions) == 0 {
		return s
	}
	res := ""
	prevEnd := 0
	positions := ""
	if flgPositions {
		for _, pos := range matchPositions {
			positions += fmt.Sprintf("[%d %d] ", pos, termLen)
		}
		fmt.Printf("s: %s\n", s)
		fmt.Printf("pos: %s\n", positions)
	}

	for _, pos := range matchPositions {
		res += s[prevEnd:pos]
		res += colorMatch
		prevEnd = pos + termLen
		res += s[pos:prevEnd]
		res += colorReset
	}
	res += s[prevEnd:len(s)]
	return res
}

func searchNote(term string, note *Note) *Match {
	if note.IsDeleted {
		return nil
	}
	var match Match
	match.note = note
	termLen := len(term)
	s := strings.ToLower(note.Title)
	currOff := 0
	for {
		idx := strings.Index(s, term)
		if idx == -1 {
			break
		}
		match.titleMatchPos = append(match.titleMatchPos, idx+currOff)
		s = s[idx+termLen:]
		currOff += idx + termLen
	}

	s = strings.ToLower(note.Content())
	currOff = 0
	for {
		idx := strings.Index(s, term)
		if idx == -1 {
			break
		}
		match.bodyMatchPos = append(match.bodyMatchPos, idx+currOff)
		s = s[idx+termLen:]
		currOff += idx + termLen
	}
	if len(match.titleMatchPos) > 0 || len(match.bodyMatchPos) > 0 {
		return &match
	}
	return nil
}

func searchAllNotes(term string) {
	timeStart := time.Now()
	notes, err := dbGetAllNotes()
	u.PanicIfErr(err)
	fmt.Printf("got %d notes in %s\n", len(notes), time.Since(timeStart))

	timeStart = time.Now()
	term = strings.ToLower(term)
	var matches []*Match
	for _, n := range notes {
		match := searchNote(term, n)
		if match != nil {
			matches = append(matches, match)
		}
	}
	fmt.Printf("found %d matches in %s\n", len(matches), time.Since(timeStart))
	for _, match := range matches {
		if len(match.titleMatchPos) > 0 {
			s := decorate(match.note.Title, len(term), match.titleMatchPos)
			fmt.Printf("%s\n", s)
		}
	}
}
