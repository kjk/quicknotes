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

// TODO: sort results by score
// TODO: break term by space and use it as AND filter (e.g. "foo bar" is where
// both "foo" and "bar" are present)
func searchNotes(term string, notes []*Note) []*Match {
	term = strings.ToLower(term)
	var matches []*Match
	for _, n := range notes {
		match := searchNote(term, n)
		if match != nil {
			matches = append(matches, match)
		}
	}
	return matches
}

func sprintNoteID(n *Note, shown *bool) string {
	if *shown {
		return ""
	}
	return fmt.Sprintf("\nNote id: %s\n", n.IDStr)
}

func noteMatchToHTML(term string, match *Match) string {
	n := match.note
	var res string
	if len(match.titleMatchPos) > 0 {
		s := decorate(n.Title, len(term), match.titleMatchPos)
		res += fmt.Sprintf("Title: %s\n", s)
	}
	if len(match.bodyMatchPos) > 0 {
		lineMatches := matchToLines([]byte(n.Content()), match.bodyMatchPos)
		lineMatches = collapseSameLines(lineMatches)
		for _, lm := range lineMatches {
			s := decorate(lm.line, len(term), lm.matches)
			s = trimSpaceLineRight(s)
			res += fmt.Sprintf("%d: %s\n", lm.lineNo+1, s)
		}
	}
	return res
}

func noteMatchToString(term string, match *Match) string {
	n := match.note

	shownID := false
	var res string
	if len(match.titleMatchPos) > 0 {
		res += sprintNoteID(n, &shownID)
		s := decorate(n.Title, len(term), match.titleMatchPos)
		res += fmt.Sprintf("Title: %s\n", s)
	}
	if len(match.bodyMatchPos) > 0 {
		res += sprintNoteID(n, &shownID)
		lineMatches := matchToLines([]byte(n.Content()), match.bodyMatchPos)
		lineMatches = collapseSameLines(lineMatches)
		for _, lm := range lineMatches {
			s := decorate(lm.line, len(term), lm.matches)
			s = trimSpaceLineRight(s)
			res += fmt.Sprintf("%d: %s\n", lm.lineNo+1, s)
		}
	}
	return res
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
