package main

import "net/http"

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
func (rrw *RecordingResponseWriter) Header() http.Header {
	return rrw.w.Header()
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
