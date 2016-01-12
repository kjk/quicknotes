package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kjk/log"
	"github.com/kjk/simplenote"
)

const (
	simplenoteAPIKey = "b6550d1ac75048988d9007aeae5dda6b"
)

var (
	nextImportID int
	// TODO: do a cleanup of old imports
	imports  []*ImportStatus
	muImport sync.Mutex
)

// ImportStatus describes an import in progress
type ImportStatus struct {
	importID      int
	userID        int
	ImportedCount int
	IsFinished    bool
	Error         string `json:",omitempty"`
	Duration      time.Duration
	startedAt     time.Time
}

func withLockedImport(id int, f func(*ImportStatus)) {
	muImport.Lock()
	defer muImport.Unlock()
	for _, s := range imports {
		if s.importID == id {
			f(s)
			return
		}
	}
}

func newImportStatus(userID int) int {
	muImport.Lock()
	nextImportID++
	importID := nextImportID
	importStatus := &ImportStatus{
		importID:  importID,
		userID:    userID,
		startedAt: time.Now(),
	}
	imports = append(imports, importStatus)
	muImport.Unlock()
	return importID
}

func findImportByID(id int) (ImportStatus, bool) {
	muImport.Lock()
	defer muImport.Unlock()
	for _, s := range imports {
		if s.importID == id {
			return *s, true
		}
	}
	return ImportStatus{}, false
}

func importSetCount(id int, nImported int) {
	withLockedImport(id, func(status *ImportStatus) {
		status.ImportedCount = nImported
		status.Duration = time.Since(status.startedAt)
	})
}

func importSetError(id int, err string) {
	withLockedImport(id, func(status *ImportStatus) {
		status.Error = err
		status.IsFinished = true
		status.Duration = time.Since(status.startedAt)
	})
}

func importMarkFinished(id int) {
	withLockedImport(id, func(status *ImportStatus) {
		status.IsFinished = true
		status.Duration = time.Since(status.startedAt)
	})
}

func importSimpleNote(id int, userID int, email, password string) {
	client := simplenote.NewClient(simplenoteAPIKey, email, password)
	notes, err := client.List()
	if err != nil {
		log.Errorf("c.List() failed with '%s'\n", err)
		importSetError(id, fmt.Sprintf("c.List() failed with '%s'", err))
		return
	}

	n := 0
	for _, note := range notes {
		newNote := NewNote{
			format:    formatText,
			createdAt: note.CreationDate,
			isDeleted: note.Deleted,
		}
		newNote.isPublic, newNote.tags = tagsToPublicTags(note.Tags)
		newNote.title, newNote.content = noteToTitleContent([]byte(note.Content))
		if len(newNote.content) == 0 {
			log.Infof("   skipping an empty note\n")
			continue
		}

		noteID, err := dbCreateOrUpdateNote(userID, &newNote)
		if err != nil {
			log.Errorf("dbCreateOrUpdateNote() failed with %s\n", err)
			importSetError(id, fmt.Sprintf("dbCreateOrUpdateNote() failed with %s", err))
			return
		}
		msg := fmt.Sprintf("note %d, modTime: %s, title: '%s', noteId: %d\n", n, newNote.createdAt, newNote.title, noteID)
		if newNote.isDeleted {
			msg = fmt.Sprintf("deleted note %d, modTime: %s, title: '%s', noteId: %d\n", n, newNote.createdAt, newNote.title, noteID)
		}
		log.Infof("%s", msg)
		n++
		importSetCount(id, n)
	}
	importMarkFinished(id)
}

func tagsToPublicTags(tags []string) (bool, []string) {
	for i, tag := range tags {
		if tag == "__public" {
			tags = append(tags[:i], tags[i+1:]...)
			return true, tags
		}
	}
	return false, tags
}

/* GET /importsimplenotestatus
args:
  id      : import id
result:
  {
    ImportedCount: 5,
    IsFinished; true,
    Error: "",
    Duration: "5 secs"
  }
*/
func handleStatusImportSimpleNotes(w http.ResponseWriter, r *http.Request) {
	log.Infof("handleImportSimpleNoteStatus(): url: '%s'\n", r.URL.Path)
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil {
		httpErrorWithJSONf(w, "not logged in")
		return
	}
	idStr := strings.TrimSpace(r.FormValue("id"))
	id, err := strconv.Atoi(idStr)
	if err != nil {
		httpErrorWithJSONf(w, "missing or invalid id value ('%s')", idStr)
		return
	}
	status, ok := findImportByID(id)
	if !ok {
		httpErrorWithJSONf(w, "no ipmort with id %d", id)
		return
	}
	if status.userID != dbUser.ID {
		log.Errorf("status.userID=%d, dbUser.ID=%d\n", status.userID, dbUser.ID)
		httpErrorWithJSONf(w, "not the right user")
		return
	}
	if !status.IsFinished {
		status.Duration = time.Since(status.startedAt)
	}
	httpOkWithJSON(w, r, status)
}

/* GET /importsimplenote
args:
  email   : simplenote user e-email
  assword : simplenote user password
result:
  {
    ImportID: 5
  }
*/
func handleStartImportSimpleNote(w http.ResponseWriter, r *http.Request) {
	log.Infof("handleImportSimpleNote(): url: '%s'\n", r.URL.Path)
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil {
		httpErrorWithJSONf(w, "not logged in")
		return
	}
	email := strings.TrimSpace(r.FormValue("email"))
	password := strings.TrimSpace(r.FormValue("password"))
	if email == "" || password == "" {
		httpErrorWithJSONf(w, "Missing email or password.")
		return
	}
	log.Infof("Importing for user: %s, email: '%s', pwd: '%s'\n", dbUser.Login, email, password)
	id := newImportStatus(dbUser.ID)
	go importSimpleNote(id, dbUser.ID, email, password)
	v := struct {
		ImportID int
	}{
		ImportID: id,
	}
	httpOkWithJSON(w, r, v)
}
