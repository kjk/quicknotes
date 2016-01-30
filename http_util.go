package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/kjk/log"
)

func httpErrorf(w http.ResponseWriter, format string, args ...interface{}) {
	msg := format
	if len(args) > 0 {
		msg = fmt.Sprintf(format, args...)
	}
	http.Error(w, msg, http.StatusInternalServerError)
}

func acceptsGzip(r *http.Request) bool {
	return r != nil && strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")
}

func httpOkBytesWithContentType(w http.ResponseWriter, r *http.Request, contentType string, content []byte) {
	w.Header().Set("Content-Type", contentType)
	// https://www.maxcdn.com/blog/accept-encoding-its-vary-important/
	// prevent caching non-gzipped version
	w.Header().Add("Vary", "Accept-Encoding")
	if acceptsGzip(r) {
		w.Header().Set("Content-Encoding", "gzip")
		// Maybe: if len(content) above certain size, write as we go (on the other
		// hand, if we keep uncompressed data in memory...)
		var buf bytes.Buffer
		gz := gzip.NewWriter(&buf)
		gz.Write(content)
		gz.Close()
		content = buf.Bytes()
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(content)))
	w.Write(content)
}

func httpOkWithText(w http.ResponseWriter, s string) {
	w.Header().Set("Content-Type", "text/plain")
	io.WriteString(w, s)
}

func httpOkWithJSON(w http.ResponseWriter, r *http.Request, v interface{}) {
	b, err := json.MarshalIndent(v, "", "\t")
	if err != nil {
		// should never happen
		log.Errorf("json.MarshalIndent() failed with %q\n", err)
	}
	httpOkBytesWithContentType(w, r, "application/json", b)
}

func httpOkWithJSONCompact(w http.ResponseWriter, r *http.Request, v interface{}) {
	b, err := json.Marshal(v)
	if err != nil {
		// should never happen
		log.Errorf("json.MarshalIndent() failed with %q\n", err)
	}
	httpOkBytesWithContentType(w, r, "application/json", b)
}

func httpOkWithJsonpCompact(w http.ResponseWriter, r *http.Request, v interface{}, jsonp string) {
	if jsonp == "" {
		httpOkWithJSONCompact(w, r, v)
	} else {
		b, err := json.Marshal(v)
		if err != nil {
			// should never happen
			log.Errorf("json.MarshalIndent() failed with %q\n", err)
		}
		res := []byte(jsonp)
		res = append(res, '(')
		res = append(res, b...)
		res = append(res, ')')
		httpOkBytesWithContentType(w, r, "application/json", res)
	}
}

func httpErrorWithJSONf(w http.ResponseWriter, r *http.Request, format string, arg ...interface{}) {
	msg := fmt.Sprintf(format, arg...)
	model := struct {
		Error string `json:"error"`
	}{
		Error: msg,
	}
	httpOkWithJSON(w, r, model)
}

func serveError(w http.ResponseWriter, r *http.Request, isJSON bool, errMsg string) {
	log.Errorf("uri: '%s', err: '%s', isJSON: %v\n", r.RequestURI, errMsg, isJSON)
	if isJSON {
		httpErrorWithJSONf(w, r, errMsg)
	} else {
		http.NotFound(w, r)
	}
}

func httpServerError(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "internal server error", http.StatusInternalServerError)
}

func getReferer(r *http.Request) string {
	return r.Header.Get("Referer")
}

func dumpFormValueNames(r *http.Request) {
	r.ParseForm()
	r.ParseMultipartForm(128 * 1024)
	for k := range r.Form {
		fmt.Printf("r.Form: '%s'\n", k)
	}
	if form := r.MultipartForm; form != nil {
		for k := range form.Value {
			fmt.Printf("r.MultipartForm: '%s'\n", k)
		}
	}
}

func writeHeader(w http.ResponseWriter, code int, contentType string) {
	w.Header().Set("Content-Type", contentType+"; charset=utf-8")
	w.WriteHeader(code)
}

func servePlainText(w http.ResponseWriter, r *http.Request, code int, format string, args ...interface{}) {
	writeHeader(w, code, "text/plain")
	var err error
	if len(args) > 0 {
		_, err = w.Write([]byte(fmt.Sprintf(format, args...)))
	} else {
		_, err = w.Write([]byte(format))
	}
	if err != nil {
		log.Errorf("err: '%s'\n", err)
	}
}

func serveData(w http.ResponseWriter, r *http.Request, code int, contentType string, data, gzippedData []byte) {
	d := data
	if len(contentType) > 0 {
		w.Header().Set("Content-Type", contentType)
	}
	// https://www.maxcdn.com/blog/accept-encoding-its-vary-important/
	// prevent caching non-gzipped version
	w.Header().Add("Vary", "Accept-Encoding")

	if acceptsGzip(r) && len(gzippedData) > 0 {
		d = gzippedData
		w.Header().Set("Content-Encoding", "gzip")
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(d)))
	w.WriteHeader(code)
	w.Write(d)
}
