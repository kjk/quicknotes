package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
)

func fatalIfErr(err error, what string) {
	if err != nil {
		log.Fatalf("%s failed with %s\n", what, err)
	}
}

func httpErrorf(w http.ResponseWriter, format string, args ...interface{}) {
	msg := format
	if len(args) > 0 {
		msg = fmt.Sprintf(format, args...)
	}
	http.Error(w, msg, http.StatusInternalServerError)
}

func httpOkBytesWithContentType(w http.ResponseWriter, contentType string, content []byte) {
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(content)))
	w.Write(content)
}

func httpOkWithText(w http.ResponseWriter, s string) {
	w.Header().Set("Content-Type", "text/plain")
	io.WriteString(w, s)
}

func httpOkWithJSON(w http.ResponseWriter, v interface{}) {
	b, err := json.MarshalIndent(v, "", "\t")
	if err != nil {
		// should never happen
		LogErrorf("json.MarshalIndent() failed with %q\n", err)
	}
	httpOkBytesWithContentType(w, "application/json", b)
}

func httpOkWithJSONCompact(w http.ResponseWriter, v interface{}) {
	b, err := json.Marshal(v)
	if err != nil {
		// should never happen
		LogErrorf("json.MarshalIndent() failed with %q\n", err)
	}
	httpOkBytesWithContentType(w, "application/json", b)
}

func httpErrorWithJSONf(w http.ResponseWriter, format string, arg ...interface{}) {
	msg := fmt.Sprintf(format, arg...)
	model := struct {
		Error string
	}{
		Error: msg,
	}
	httpOkWithJSON(w, model)
}

func httpServerError(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "internal server error", http.StatusInternalServerError)
}

func getReferer(r *http.Request) string {
	return r.Header.Get("Referer")
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
