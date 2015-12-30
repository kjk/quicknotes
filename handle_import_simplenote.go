package main

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/kjk/simplenote"
)

const (
	simplenoteAPIKey = "b6550d1ac75048988d9007aeae5dda6b"
)

func tagsToPublicTags(tags []string) (bool, []string) {
	for i, tag := range tags {
		if tag == "__public" {
			tags = append(tags[:i], tags[i+1:]...)
			return true, tags
		}
	}
	return false, tags
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
	LogInfof("Importing for user: %s, email: '%s', pwd: '%s'\n", dbUser.Login, email, password)
	client := simplenote.NewClient(simplenoteAPIKey, email, password)
	notes, err := client.List()
	if err != nil {
		LogErrorf("c.List() failed with '%s'\n", err)
		httpErrorf(w, "c.List() failed with '%s'", err)
	}
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(200)
	n := 1
	for _, note := range notes {
		newNote := NewNote{
			format:    formatText,
			createdAt: note.CreationDate,
			isDeleted: note.Deleted,
		}
		newNote.isPublic, newNote.tags = tagsToPublicTags(note.Tags)
		newNote.title, newNote.content = noteToTitleContent([]byte(note.Content))
		if len(newNote.content) == 0 {
			LogInfof("   skipping an empty note\n")
			continue
		}

		noteID, err := dbCreateOrUpdateNote(dbUser.ID, &newNote)
		if err != nil {
			LogErrorf("dbCreateOrUpdateNote() failed with %s\n", err)
		}
		msg := fmt.Sprintf("note %d, modTime: %s, title: '%s', noteId: %d\n", n, newNote.createdAt, newNote.title, noteID)
		if newNote.isDeleted {
			msg = fmt.Sprintf("deleted note %d, modTime: %s, title: '%s', noteId: %d\n", n, newNote.createdAt, newNote.title, noteID)
		}
		LogInfof(msg) // TODO: add LogInfo(), this is not great if msg contains formatting instructions
		w.Write([]byte(msg))
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
		n++
	}
	w.Write([]byte("Finished importing notes\n"))
}
