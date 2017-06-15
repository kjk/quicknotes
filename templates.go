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

	"github.com/kjk/quicknotes/pkg/log"
	"github.com/kjk/u"
)

var (
	tmplIndex      = "index.html"
	tmplNotesIndex = "notes_index.html"
	templateNames  = []string{tmplIndex, tmplNotesIndex}
	templatePaths  []string
	templates      *template.Template

	reloadTemplates = true
)

func getTemplates() *template.Template {
	if reloadTemplates || (nil == templates) {
		var t *template.Template
		for _, name := range templateNames {
			filename := filepath.Join("static", name)
			b, err := loadResourceFile(filename)
			u.PanicIfErr(err, "loadResourceFile() failed")
			s := string(b)
			name := filepath.Base(filename)
			var tmpl *template.Template
			if t == nil {
				t = template.New(name)
			}
			if name == t.Name() {
				tmpl = t
			} else {
				tmpl = t.New(name)
			}
			_, err = tmpl.Parse(s)
			u.PanicIfErr(err, "tmpl.Parse() failed")
		}
		templates = t
	}
	return templates
}

func serveTemplate(w http.ResponseWriter, templateName string, model interface{}) bool {
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

func serveTemplateFile(path string, templateName string, model interface{}) error {
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
