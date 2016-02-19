package main

import (
	"bufio"
	"bytes"
	"fmt"
	"mime"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"unicode"

	"github.com/kjk/log"
	"github.com/kjk/u"
	"github.com/speps/go-hashids"
)

var (
	// TODO: not sure if I need this
	hashIDMu sync.Mutex
	hashID   *hashids.HashID
)

func fatalIfErr(err error, what string) {
	if err != nil {
		log.Fatalf("%s failed with %s\n", what, err)
	}
}

func fatalif(cond bool, format string, args ...interface{}) {
	if cond {
		log.Fatalf(format, args...)
	}
}

func isWin() bool {
	return runtime.GOOS == "windows"
}

func isMac() bool {
	return runtime.GOOS == "darwin"
}

var extraMimeTypes = map[string]string{
	".icon": "image-x-icon",
	".ttf":  "application/x-font-ttf",
	".woff": "application/x-font-woff",
	".eot":  "application/vnd.ms-fontobject",
	".svg":  "image/svg+xml",
}

// MimeTypeByExtensionExt is like mime.TypeByExtension but supports more types
// and defaults to text/plain
func MimeTypeByExtensionExt(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	result := mime.TypeByExtension(ext)

	if result == "" {
		result = extraMimeTypes[ext]
	}

	if result == "" {
		result = "text/plain; charset=utf-8"
	}

	return result
}

// heuristic: auto-detects title from the note body. Title is first line if
// relatively short and followed by empty line
func noteToTitleContent(d []byte) (string, []byte) {
	// title is a short line followed by an empty line
	advance1, line1, err := bufio.ScanLines(d, false)
	if err != nil || len(line1) > 100 {
		return "", d
	}
	advance2, line2, err := bufio.ScanLines(d[advance1:], false)
	if err != nil || len(line2) > 0 {
		return "", d
	}
	title, content := string(line1), d[advance1+advance2:]
	if len(content) == 0 && len(title) > 0 {
		content = []byte(title)
		title = ""
	}
	return title, content
}

func trimSpaceLineRight(s string) string {
	if len(s) == 0 {
		return ""
	}
	n := len(s) - 1
	for n >= 0 && isNewline(s[n]) {
		n--
	}
	return s[:n+1]
}

// given foo@bar.com, returns foo
func nameFromEmail(email string) string {
	parts := strings.Split(email, "@")
	return parts[0]
}

func initHashID() {
	hd := hashids.NewData()
	hd.Salt = "bo-&)()(*&tamalola"
	hd.MinLength = 4
	hashID = hashids.NewWithData(hd)
}

func hashInt(n int) string {
	nums := []int{n}
	hashIDMu.Lock()
	res, err := hashID.Encode(nums)
	hashIDMu.Unlock()
	u.PanicIfErr(err)
	return res
}

// hashID.Decode() can panic, so guard against that
func dehashIntSafe(s string) []int {
	var res []int
	defer func() {
		if r := recover(); r != nil {
			res = nil
		}
	}()
	res = hashID.Decode(s)
	return res
}

// TODO: hashID.Decode() may panic, so either wrap it inside recover()
// or fork go-hashids to change Decode() to not panic.
func dehashInt(s string) (int, error) {
	hashIDMu.Lock()
	defer hashIDMu.Unlock()
	nums := dehashIntSafe(s)
	if len(nums) != 1 {
		return -1, fmt.Errorf("dehashInt: invalid valude '%s'", s)
	}
	return nums[0], nil
}

func strArrEqual(a1, a2 []string) bool {
	if len(a1) != len(a2) {
		return false
	}
	if len(a1) == 0 {
		return true
	}
	m := map[string]int{}
	for _, t := range a1 {
		m[t] = 1
	}
	for _, t := range a2 {
		if _, ok := m[t]; !ok {
			return false
		}
		m[t] = 2
	}
	// the value for the key can either be 2 if the key is in both
	// arrays or 1 if only in a1, which indicates arrays are not
	// the same
	for _, n := range m {
		if n != 2 {
			return false
		}
	}
	return true
}

// convert all whitespace characters to a regular space
func wsToSpace(c rune) rune {
	if unicode.IsSpace(c) {
		return ' '
	}
	return c
}

func isWs(c byte) bool {
	switch c {
	case ' ', '\t', '\n':
		return true
	}
	return false
}

// trim from the right all non-whitespace chars
func nonWhitespaceRightTrim(s string) string {
	n := len(s) - 1
	for ; n >= 0 && !isWs(s[n]); n-- {
	}
	if n < 15 {
		return s
	}
	s = s[:n]
	return s + "..."
}

func strArrRemoveEmptyAlwaysAlloc(a []string) []string {
	n := len(a)
	res := make([]string, 0, n)
	for _, el := range a {
		if len(el) > 0 {
			res = append(res, el)
		}
	}
	return res
}

// return array with empty strings removed
func strArrRemoveEmpty(a []string) []string {
	for _, el := range a {
		if len(el) == 0 {
			return strArrRemoveEmptyAlwaysAlloc(a)
		}
	}
	return a
}

func getLines(d []byte, maxLines int, maxSize int) ([]byte, [][]byte) {
	var lines [][]byte
	prevLineWasEmpty := false
	d = bytes.TrimSpace(d)
	sizeLeft := maxSize
	for len(d) > 0 && sizeLeft > 0 && len(lines) < maxLines {
		advance, line, err := bufio.ScanLines(d, true)
		if err != nil || advance == 0 {
			break
		}
		line = bytes.TrimRightFunc(line, unicode.IsSpace)
		lineIsEmpty := len(line) == 0
		skip := lineIsEmpty && prevLineWasEmpty
		if !skip {
			lines = append(lines, line)
			sizeLeft -= len(line)
		}
		prevLineWasEmpty = lineIsEmpty
		d = d[advance:]
	}
	return bytes.TrimSpace(d), lines
}

// truncate intelligently content of the note
func getShortSnippet(d []byte) ([]byte, bool) {
	d, lines := getLines(d, 10, 512)
	if len(d) == 0 {
		res := bytes.Join(lines, []byte{'\n'})
		return res, false
	}
	d2, lines2 := getLines(d, 3, 80*3)
	// if less 13 lines, it's not truncated
	if len(d2) == 0 {
		lines = append(lines, lines2...)
		res := bytes.Join(lines, []byte{'\n'})
		return res, false
	}
	truncated := len(d) > 0
	res := bytes.Join(lines, []byte{'\n'})
	return res, truncated
}

// returns first non-empty line
func getFirstLine(d []byte) []byte {
	for {
		advance, line, err := bufio.ScanLines(d, false)
		if err != nil {
			return nil
		}
		if len(line) > 0 {
			return line
		}
		if advance == 0 {
			return nil
		}
		d = d[advance:]
	}
}
