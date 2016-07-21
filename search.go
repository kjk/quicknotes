package main

import (
	"fmt"
	"html"
	"sort"
	"strings"
)

const (
	colorReset             = "\x1b[0m\x1b[K"
	colorMatch             = "\x1b[30;43m" // black text with yellow background
	maxSearchResultLineLen = 120
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

// BySimpleMatchScore is for sorting by match score
type BySimpleMatchScore []*MatchWithSimpleNote

func (m BySimpleMatchScore) Len() int {
	return len(m)
}

func (m BySimpleMatchScore) Swap(i, j int) {
	m[i], m[j] = m[j], m[i]
}

func (m BySimpleMatchScore) Less(i, j int) bool {
	m1, m2 := m[i].match, m[j].match
	return matchLess(m1, m2)
}

// PosLenByPos is for sorting PosLen by position
type PosLenByPos []PosLen

func (a PosLenByPos) Len() int {
	return len(a)
}

func (a PosLenByPos) Swap(i, j int) {
	a[i], a[j] = a[j], a[i]
}

func (a PosLenByPos) Less(i, j int) bool {
	pl1, pl2 := a[i], a[j]
	return pl1.Pos < pl2.Pos
}

func decorate(s string, matchPositions []PosLen) string {
	res := ""
	positions := ""
	if flgPositions {
		res += fmt.Sprintf("s: %s\n", s)
		for _, pl := range matchPositions {
			positions += fmt.Sprintf("[%d %d] ", pl.Pos, pl.Len)
		}
		res += fmt.Sprintf("pos: %s\n", positions)
	}

	parts := stringToStringParts(s, matchPositions)
	for _, sp := range parts {
		if sp.isHighlight {
			res += colorMatch + sp.s + colorReset
		} else {
			res += sp.s
		}
	}
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

func appendMatch(m *Match, toAppend *Match) {
	m.titleMatchPos = append(m.titleMatchPos, toAppend.titleMatchPos...)
	m.bodyMatchPos = append(m.bodyMatchPos, toAppend.bodyMatchPos...)
}

func sortMatchPositions(m *Match) {
	if m == nil {
		return
	}
	sort.Sort(PosLenByPos(m.titleMatchPos))
	sort.Sort(PosLenByPos(m.bodyMatchPos))
}

// search a note for list of terms. This is AND search i.e. all terms
// must be found
func searchNote(terms []string, note *Note, maxMatches int) *Match {
	if note.IsDeleted {
		return nil
	}
	var res *Match
	for _, term := range terms {
		match := searchTitleAndBody(term, note.Title, note.Content(), maxMatches)
		if match == nil {
			return nil
		}
		match.note = note
		if res == nil {
			res = match
		} else {
			appendMatch(res, match)
		}
	}
	sortMatchPositions(res)
	return res
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

func splitTerm(term string) []string {
	term = strings.ToLower(term)
	term = strings.Map(wsToSpace, term)
	terms := strings.Split(term, " ")
	return strArrRemoveEmpty(terms)
}

func searchNotes(term string, notes []*Note, maxResults int) []*Match {
	terms := splitTerm(term)
	if len(terms) == 0 {
		return nil
	}

	var matches []*Match
	for _, n := range notes {
		match := searchNote(terms, n, 16)
		if match != nil {
			matches = append(matches, match)
			if maxResults != -1 && len(matches) >= maxResults {
				break
			}
		}
	}
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

// StringPart describes part of the string
type StringPart struct {
	s           string
	isHighlight bool
}

func stringToStringParts(str string, matchPositions []PosLen) []StringPart {
	var res []StringPart
	prevEnd := 0
	for _, mp := range matchPositions {
		pos := mp.Pos
		s := str[prevEnd:pos]
		if len(s) > 0 {
			res = append(res, StringPart{s, false})
		}
		prevEnd = pos + mp.Len
		res = append(res, StringPart{str[pos:prevEnd], true})
	}

	s := str[prevEnd:len(str)]
	if len(s) > 0 {
		res = append(res, StringPart{s, false})
	}
	return res
}

func removeStringPart(a []StringPart, i int) []StringPart {
	return append(a[:i], a[i+1:]...)
}

func limitLineLength(parts []StringPart, maxLen int) []StringPart {
	removedLast := false
	for {
		totalLen := 0
		highlightedLen := 0
		for _, sp := range parts {
			totalLen += len(sp.s)
			if sp.isHighlight {
				highlightedLen += len(sp.s)
			}
		}
		if totalLen <= maxLen {
			return parts
		}
		n := len(parts)
		if !removedLast {
			removedLast = true
			sp := parts[n-1]
			if !sp.isHighlight {
				toKeepLen := maxLen - (totalLen - len(sp.s))
				toKeepStr := ""
				if toKeepLen > 6 {
					toKeepLen -= 3
					toKeepStr = sp.s[:toKeepLen] + "..."
				}
				parts = removeStringPart(parts, n-1)
				if len(toKeepStr) > 0 {
					parts = append(parts, StringPart{toKeepStr, false})
				}
			}
			continue
		}
		break
	}
	return parts
}

func decorateHTML(s string, matchPositions []PosLen) string {
	parts := stringToStringParts(s, matchPositions)
	if len(s) > maxSearchResultLineLen {
		parts = limitLineLength(parts, maxSearchResultLineLen)
	}
	res := ""
	for _, sp := range parts {
		if sp.isHighlight {
			res += `<span class="s-h">` + html.EscapeString(sp.s) + `</span>`
		} else {
			res += html.EscapeString(sp.s)
		}
	}
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
