package main

import (
	"bytes"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"text/template"
)

var (
	tmplIndex     = "index.html"
	tmplUser      = "user.html"
	templateNames = []string{tmplIndex, tmplUser}
	templatePaths []string
	templates     *template.Template

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
		fmt.Printf("Failed to execute template %q, error: %s", templateName, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return false
	}

	// at this point we ignore error
	w.Header().Set("Content-Length", strconv.Itoa(len(buf.Bytes())))
	w.Write(buf.Bytes())
	return true
}
