package main

import (
	"bufio"
	"fmt"
	"net/http"
	"strings"

	"github.com/kjk/simplenote"
)

const (
	simplenoteAPIKey = "b6550d1ac75048988d9007aeae5dda6b"
)

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

// url: GET /importsimplenote?email=${email}&password=${password}
func handleImportSimpleNote(w http.ResponseWriter, r *http.Request) {
	LogInfof("handleImportSimpleNote(): url: '%s'\n", r.URL.Path)
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil {
		httpErrorf(w, "not logged in")
		return
	}
	email := strings.TrimSpace(r.FormValue("email"))
	password := strings.TrimSpace(r.FormValue("password"))
	fmt.Printf("Importing for user: %s, email: '%s', pwd: '%s'\n", dbUser.Login.String, email, password)
	client := simplenote.NewClient(simplenoteAPIKey, email, password)
	notes, err := client.List()
	if err != nil {
		fmt.Printf("c.List() failed with '%s'\n", err)
		httpErrorf(w, "c.List() failed with '%s'", err)
	}
	n := 1
	for _, note := range notes {
		newNote := NewNote{
			format:    formatText,
			tags:      note.Tags,
			createdAt: note.CreationDate,
		}
		newNote.title, newNote.content = noteToTitleContent([]byte(note.Content))
		if len(newNote.content) == 0 {
			fmt.Printf("   skipping an empty note\n")
			continue
		}

		noteID, err := dbCreateNewNote(dbUser.ID, &newNote)
		if err != nil {
			fmt.Printf("dbCreateNewNote() failed with %s\n", err)
		}
		fmt.Printf("note %d, modTime: %s, title: '%s', noteId: %d\n", n, newNote.createdAt, newNote.title, noteID)
		n++
	}
	model := struct {
		Message string
	}{
		Message: fmt.Sprintf("Imported %d notes from SimpleNote", n),
	}
	execTemplate(w, tmplResult, model)
}
