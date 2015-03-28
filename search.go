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

// LineMatch represents a match in the line
type LineMatch struct {
	lineNo  int
	line    string
	matches []int // can be empty
}

func trimSpaceLineRight(s string) string {
	n := len(s) - 1
	for n >= 0 && isNewline(s[n]) {
		n--
	}
	return s[:n]
}

func findLineForPos(linesInfo *LinesInfo, pos int) *LineMatch {
	for i := 0; i < linesInfo.LineCount(); i++ {
		lineStart, lineLen := linesInfo.PosLen(i)
		if pos >= lineStart && pos < lineStart+lineLen {
			d := linesInfo.d
			res := &LineMatch{
				lineNo:  i,
				line:    string(d[lineStart : lineStart+lineLen]),
				matches: []int{pos - lineStart},
			}
			return res
		}
	}
	return nil
}

func matchToLines(d []byte, matchPos []int) []*LineMatch {
	linesInfo := detectLines(d)
	var res []*LineMatch
	for _, pos := range matchPos {
		m := findLineForPos(linesInfo, pos)
		res = append(res, m)
	}
	return res
}

func collapseSameLines(lineMatches []*LineMatch) []*LineMatch {
	if len(lineMatches) < 2 {
		return lineMatches
	}
	res := lineMatches
	for i := 1; i < len(res); i++ {
		if res[i].lineNo == res[i-1].lineNo {
			res[i-1].matches = append(res[i-1].matches, res[i].matches[0])
			res = append(res[:i], res[i+1:]...)
		}
	}
	return res
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

	for _, match := range matches {
		note := match.note
		if len(match.titleMatchPos) > 0 {
			s := decorate(match.note.Title, len(term), match.titleMatchPos)
			fmt.Printf("Title: %s\n", s)
		}
		if len(match.bodyMatchPos) > 0 {
			lineMatches := matchToLines([]byte(note.Content()), match.bodyMatchPos)
			lineMatches = collapseSameLines(lineMatches)
			for _, lm := range lineMatches {
				s := decorate(lm.line, len(term), lm.matches)
				s = trimSpaceLineRight(s)
				fmt.Printf("%d: %s\n", lm.lineNo+1, s)
			}
		}
	}
	fmt.Printf("found %d matches in %s\n", len(matches), time.Since(timeStart))
}
