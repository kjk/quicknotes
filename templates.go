package main

import (
	"bytes"
	"compress/gzip"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/kjk/log"
)

var (
	tmplIndex      = "index.html"
	tmplUser       = "user.html"
	tmplResult     = "result.html"
	tmplNote       = "note.html"
	tmplNotesIndex = "notes_index.html"
	templateNames  = []string{tmplIndex, tmplUser, tmplResult, tmplNote, tmplNotesIndex}
	templatePaths  []string
	templates      *template.Template

	reloadTemplates = true
)

func getTemplates() *template.Template {
	if reloadTemplates || (nil == templates) {
		if 0 == len(templatePaths) {
			for _, name := range templateNames {
				templatePaths = append(templatePaths, filepath.Join("s", name))
			}
		}
		templates = template.Must(template.ParseFiles(templatePaths...))
	}
	return templates
}

func execTemplate(w http.ResponseWriter, templateName string, model interface{}) bool {
	var buf bytes.Buffer
	if err := getTemplates().ExecuteTemplate(&buf, templateName, model); err != nil {
		log.Errorf("Failed to execute template %q, error: %s", templateName, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return false
	}

	// at this point we ignore error
	w.Header().Set("Content-Length", strconv.Itoa(len(buf.Bytes())))
	w.Write(buf.Bytes())
	return true
}

func execTemplateFile(path string, templateName string, model interface{}) error {
	var buf bytes.Buffer
	if err := getTemplates().ExecuteTemplate(&buf, templateName, model); err != nil {
		log.Errorf("Failed to execute template %q, error: %s", templateName, err)
		return err
	}
	var w io.Writer
	var gzipWriter *gzip.Writer
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	w = f
	if strings.HasSuffix(path, ".gz") {
		gzipWriter = gzip.NewWriter(f)
		w = gzipWriter
	}
	_, err = w.Write(buf.Bytes())
	if err != nil {
		return err
	}
	if gzipWriter != nil {
		gzipWriter.Close()
	}
	return f.Close()
}
