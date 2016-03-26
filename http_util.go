package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"

	"github.com/kjk/log"
	"github.com/kjk/u"
)

// RecordingResponseWriter records return code and number of bytes written
type RecordingResponseWriter struct {
	w            http.ResponseWriter
	Code         int
	BytesWritten int
}

// NewRecordingResponseWriter creates RecordingResponseWriter
func NewRecordingResponseWriter(w http.ResponseWriter) *RecordingResponseWriter {
	return &RecordingResponseWriter{
		w: w,
	}
}

// Header returns header map
func (w *RecordingResponseWriter) Header() http.Header {
	return w.w.Header()
}

// Write writes the data
func (rrw *RecordingResponseWriter) Write(d []byte) (int, error) {
	n, err := rrw.w.Write(d)
	rrw.BytesWritten += n
	return n, err
}

// WriteHeader sends an HTTP response header
func (rrw *RecordingResponseWriter) WriteHeader(code int) {
	rrw.Code = code
	rrw.w.WriteHeader(code)
}

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

// Request.RemoteAddress contains port, which we want to remove i.e.:
// "[::1]:58292" => "[::1]"
func ipAddrFromRemoteAddr(s string) string {
	idx := strings.LastIndex(s, ":")
	if idx == -1 {
		return s
	}
	return s[:idx]
}

// TODO: also handle Forwarded (https://en.wikipedia.org/wiki/X-Forwarded-For)
func getIPAddress(r *http.Request) string {
	hdr := r.Header
	hdrRealIP := hdr.Get("X-Real-Ip")
	hdrForwardedFor := hdr.Get("X-Forwarded-For")
	if hdrRealIP == "" && hdrForwardedFor == "" {
		return ipAddrFromRemoteAddr(r.RemoteAddr)
	}
	if hdrForwardedFor != "" {
		// X-Forwarded-For is potentially a list of addresses separated with ","
		parts := strings.Split(hdrForwardedFor, ",")
		for i, p := range parts {
			parts[i] = strings.TrimSpace(p)
		}
		// TODO: should return first non-local address
		return parts[0]
	}
	return hdrRealIP
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

func serveMaybeGzippedFile(w http.ResponseWriter, r *http.Request, path string) {
	log.Verbosef("path: '%s'\n", path)
	if !u.PathExists(path) {
		http.NotFound(w, r)
		return
	}
	contentType := MimeTypeByExtensionExt(path)
	usesGzip := acceptsGzip(r)
	if usesGzip {
		if u.PathExists(path + ".gz") {
			path = path + ".gz"
		} else {
			usesGzip = false
		}
	}
	if len(contentType) > 0 {
		w.Header().Set("Content-Type", contentType)
	}
	// https://www.maxcdn.com/blog/accept-encoding-its-vary-important/
	// prevent caching non-gzipped version
	w.Header().Add("Vary", "Accept-Encoding")
	if usesGzip {
		w.Header().Set("Content-Encoding", "gzip")
	}
	d, err := ioutil.ReadFile(path)
	if err != nil {
		log.Errorf("ioutil.ReadFile('%s') failed with '%s'\n", path, err)
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(d)))
	w.WriteHeader(200)
	w.Write(d)
}
