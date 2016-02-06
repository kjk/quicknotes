package main

import (
	"fmt"
	"sort"
	"strings"
)

const (
	colorReset = "\x1b[0m\x1b[K"
	colorMatch = "\x1b[30;43m" // black text with yellow background
)

var (
	flgPositions bool
)

// PosLen represents position and length (of a match)
type PosLen struct {
	Pos int
	Len int
}

// Match describes matches in the note
type Match struct {
	note          *Note
	titleMatchPos []PosLen
	bodyMatchPos  []PosLen
}

// ByMatchScore is for sorting search results by score
type ByMatchScore []*Match

func (m ByMatchScore) Len() int {
	fmt.Printf("len: %d\n", len(m))
	return len(m)
}

func (m ByMatchScore) Swap(i, j int) {
	m[i], m[j] = m[j], m[i]
}

func matchLess2(m1, m2 *Match) bool {
	n1 := len(m1.titleMatchPos) + len(m1.bodyMatchPos)
	n2 := len(m2.titleMatchPos) + len(m2.bodyMatchPos)
	return n1 < n2
}

// this is really a reverse compare since we want the "largest"
// results first
func matchLess(m1, m2 *Match) bool {
	n1, n2 := len(m1.titleMatchPos), len(m2.titleMatchPos)
	if n1 != n2 {
		return n1 > n2
	}
	n1, n2 = len(m1.bodyMatchPos), len(m2.bodyMatchPos)
	if n1 != n2 {
		return n1 > n2
	}
	n1, n2 = len(m1.note.Title), len(m2.note.Title)
	// notes with shorter title should show up first
	// (match is a bigger percentage of the text)
	if n1 != n2 {
		return n1 < n2
	}

	// TODO: compare sizes of bodies

	return true
}

func (m ByMatchScore) Less(i, j int) bool {
	m1, m2 := m[i], m[j]
	return matchLess(m1, m2)
}

// BySimpleMatchScore is for sorting
type BySimpleMatchScore []*MatchWithSimpleNote

func (m BySimpleMatchScore) Len() int {
	fmt.Printf("len: %d\n", len(m))
	return len(m)
}

func (m BySimpleMatchScore) Swap(i, j int) {
	m[i], m[j] = m[j], m[i]
}

func (m BySimpleMatchScore) Less(i, j int) bool {
	m1, m2 := m[i].match, m[j].match
	return matchLess(m1, m2)
}

func decorate(s string, matchPositions []PosLen) string {
	if len(matchPositions) == 0 {
		return s
	}
	res := ""
	prevEnd := 0
	positions := ""
	if flgPositions {
		for _, pl := range matchPositions {
			positions += fmt.Sprintf("[%d %d] ", pl.Pos, pl.Len)
		}
		fmt.Printf("s: %s\n", s)
		fmt.Printf("pos: %s\n", positions)
	}

	for _, pl := range matchPositions {
		pos := pl.Pos
		res += s[prevEnd:pos]
		res += colorMatch
		prevEnd = pos + pl.Len
		res += s[pos:prevEnd]
		res += colorReset
	}
	res += s[prevEnd:len(s)]
	return res
}

func searchTitleAndBody(term, title, body string, maxMatches int) *Match {
	title = strings.ToLower(title)
	body = strings.ToLower(body)

	var match Match
	termLen := len(term)
	s := title
	currOff := 0
	for {
		idx := strings.Index(s, term)
		if idx == -1 {
			break
		}
		pl := PosLen{
			Pos: idx + currOff,
			Len: termLen,
		}
		match.titleMatchPos = append(match.titleMatchPos, pl)
		s = s[idx+termLen:]
		currOff += idx + termLen
	}

	if maxMatches != -1 && len(match.titleMatchPos) >= maxMatches {
		return &match
	}

	s = body
	currOff = 0
	for {
		idx := strings.Index(s, term)
		if idx == -1 {
			break
		}
		pl := PosLen{
			Pos: idx + currOff,
			Len: termLen,
		}
		match.bodyMatchPos = append(match.bodyMatchPos, pl)
		if maxMatches != -1 {
			if len(match.titleMatchPos)+len(match.bodyMatchPos) >= maxMatches {
				return &match
			}
		}
		s = s[idx+termLen:]
		currOff += idx + termLen
	}
	if len(match.titleMatchPos) > 0 || len(match.bodyMatchPos) > 0 {
		return &match
	}
	return nil

}

func searchNote(term string, note *Note, maxMatches int) *Match {
	if note.IsDeleted {
		return nil
	}

	match := searchTitleAndBody(term, note.Title, note.Content(), maxMatches)
	if match != nil {
		match.note = note
	}
	return match
}

// LineMatch represents a match in the line
type LineMatch struct {
	lineNo  int
	line    string
	matches []PosLen // can be empty
}

func findLineForPos(linesInfo *LinesInfo, pl PosLen) *LineMatch {
	pos := pl.Pos
	for i := 0; i < linesInfo.LineCount(); i++ {
		lineStart, lineLen := linesInfo.PosLen(i)
		if pos >= lineStart && pos < lineStart+lineLen {
			d := linesInfo.d
			plRes := PosLen{
				Pos: pos - lineStart,
				Len: pl.Len,
			}
			res := &LineMatch{
				lineNo:  i,
				line:    string(d[lineStart : lineStart+lineLen]),
				matches: []PosLen{plRes},
			}
			return res
		}
	}
	return nil
}

func matchToLines(d []byte, matchPos []PosLen) []*LineMatch {
	linesInfo := detectLines(d)
	var res []*LineMatch
	for _, pl := range matchPos {
		m := findLineForPos(linesInfo, pl)
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

// TODO: break term by space and use it as AND filter (e.g. "foo bar" is where
// both "foo" and "bar" are present)
func searchNotes(term string, notes []*Note, maxResults int) []*Match {
	if len(term) == 0 {
		return nil
	}
	term = strings.ToLower(term)
	var matches []*Match
	for _, n := range notes {
		match := searchNote(term, n, 16)
		if match != nil {
			matches = append(matches, match)
			if maxResults != -1 && len(matches) >= maxResults {
				break
			}
		}
	}
	fmt.Printf("About to call sort.Sort()\n")
	sort.Sort(ByMatchScore(matches))
	return matches
}

func newTitleSearchResultItem(s string) SearchResultItem {
	return SearchResultItem{
		Type:   TypeTitle,
		LineNo: -1,
		HTML:   s,
	}
}

func newLineSearchResultItem(s string, lineNo int) SearchResultItem {
	return SearchResultItem{
		Type:   TypeLine,
		LineNo: lineNo,
		HTML:   s,
	}
}

func decorateHTML(s string, matchPositions []PosLen) string {
	if len(matchPositions) == 0 {
		return s
	}
	res := ""
	prevEnd := 0
	for _, pl := range matchPositions {
		pos := pl.Pos
		res += s[prevEnd:pos]
		res += `<span class="s-h">`
		prevEnd = pos + pl.Len
		res += s[pos:prevEnd]
		res += `</span>`
	}
	res += s[prevEnd:len(s)]
	return res
}

func noteMatchToSearchResults(term string, match *Match) []SearchResultItem {
	var res []SearchResultItem
	n := match.note
	if len(match.titleMatchPos) > 0 {
		s := decorateHTML(n.Title, match.titleMatchPos)
		res = append(res, newTitleSearchResultItem(s))
	} else {
		res = append(res, newTitleSearchResultItem(n.Title))
	}
	if len(match.bodyMatchPos) > 0 {
		lineMatches := matchToLines([]byte(n.Content()), match.bodyMatchPos)
		lineMatches = collapseSameLines(lineMatches)
		for _, lm := range lineMatches {
			s := decorateHTML(lm.line, lm.matches)
			s = trimSpaceLineRight(s)
			res = append(res, newLineSearchResultItem(s, lm.lineNo+1))
		}
	}
	return res
}
