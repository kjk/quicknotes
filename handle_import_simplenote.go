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

// TODO: don't import duplicates

const (
	simplenoteAPIKey = "b6550d1ac75048988d9007aeae5dda6b"
)

var (
	nextImportID int
	// TODO: do a cleanup of old imports
	imports  []*ImportStatus
	muImport sync.Mutex
)

// ImportStatus describes an import operation
// returned by /api/
type ImportStatus struct {
	importID      int
	userID        int
	ImportedCount int
	SkippedCount  int
	UpdatedCount  int
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

func importSetCount(id, nImported, nUpdated, nSkipped int) {
	withLockedImport(id, func(status *ImportStatus) {
		status.ImportedCount = nImported
		status.UpdatedCount = nUpdated
		status.SkippedCount = nSkipped
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

func isSimpleNoteUnothorizedError(s string) bool {
	// a heuristic
	return strings.Contains(s, "401") && strings.Contains(s, "/authorize/")
}

// SimpleNoteImport describes an import of simplenote note
type SimpleNoteImport struct {
	NoteID            int
	SimpleNoteID      string
	SimpleNoteVersion int
}

func getSimpleNoteImportsForUser(userID int) (map[string]SimpleNoteImport, error) {
	db := getDbMust()
	q := `SELECT note_id, simplenote_id, simplenote_version FROM simplenote_imports WHERE user_id = ?`
	rows, err := db.Query(q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var arr []SimpleNoteImport
	for rows.Next() {
		var sni SimpleNoteImport
		err = rows.Scan(&sni.NoteID, &sni.SimpleNoteID, &sni.SimpleNoteVersion)
		if err != nil {
			return nil, err
		}
		arr = append(arr, sni)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}
	res := make(map[string]SimpleNoteImport)
	for _, sni := range arr {
		res[sni.SimpleNoteID] = sni
	}
	return res, nil
}

func dbIsUserMe(userID int) bool {
	userDb, err := dbGetUserByIDCached(userID)
	if err != nil {
		return false
	}
	switch userDb.Login {
	case "twitter:kjk", "github:kjk", "google:kkowalczyk@gmail.com":
		return true
	}
	return false
}

func importSimpleNote(id int, userID int, email, password string) {
	shouldConvertPublic := dbIsUserMe(userID)
	client := simplenote.NewClient(simplenoteAPIKey, email, password)
	notes, err := client.List()
	if err != nil {
		log.Errorf("c.List() failed with '%s'\n", err)
		msg := fmt.Sprintf("c.List() failed with '%s'", err)
		if isSimpleNoteUnothorizedError(err.Error()) {
			msg = "Authentication failed. Invalid email or password"
		}
		importSetError(id, msg)
		return
	}

	alreadyImported, err := getSimpleNoteImportsForUser(userID)
	if err != nil {
		log.Errorf("getSimpleNoteImportsForUser() failed with '%s'\n", err)
		importSetError(id, err.Error())
		return
	}

	nImported := 0
	nUpdated := 0
	nSkipped := 0
	for _, note := range notes {
		sni, ok := alreadyImported[note.ID]
		if ok && note.Version == sni.SimpleNoteVersion {
			nSkipped++
			log.Verbosef("skipping already imported simplenote %s, %d\n", note.ID, note.Version)
			continue
		}
		newNote := NewNote{
			format:    formatText,
			createdAt: note.CreationDate,
			isDeleted: note.Deleted,
		}
		if shouldConvertPublic {
			newNote.isPublic, newNote.tags = tagsToPublicTags(note.Tags)
		}
		if ok {
			newNote.idStr = hashInt(sni.NoteID)
			log.Verbosef("updating simplenote %d, %s, %d => %d\n", sni.NoteID, note.ID, sni.SimpleNoteVersion, note.Version)
		}

		newNote.title, newNote.content = noteToTitleContent([]byte(note.Content))
		if len(newNote.content) == 0 {
			//log.Verbosef("   skipping an empty note\n")
			continue
		}

		noteID, err := dbCreateOrUpdateNote(userID, &newNote)
		if err != nil {
			log.Errorf("dbCreateOrUpdateNote() failed with %s\n", err)
			importSetError(id, fmt.Sprintf("dbCreateOrUpdateNote() failed with %s", err))
			return
		}
		if newNote.isDeleted {
			log.Verbosef("deleted note %d, modTime: %s, title: '%s', noteId: %d\n", nImported, newNote.createdAt, newNote.title, noteID)
		} else {
			log.Verbosef("note %d, modTime: %s, title: '%s', noteId: %d\n", nImported, newNote.createdAt, newNote.title, noteID)
		}
		if ok {
			nUpdated++
		} else {
			nImported++
		}
		importSetCount(id, nImported, nUpdated, nSkipped)
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

/* GET /api/import_simplenote_status
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
func handleAPIImportSimpleNotesStatus(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL.Path)
	dbUser := getDbUserFromCookie(w, r)
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

/* GET /api/import_simplenote_start
args:
  email   : simplenote user e-email
  assword : simplenote user password
result:
  {
    ImportID: 5
  }
*/
func handleAPIImportSimpleNoteStart(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL.Path)
	dbUser := getDbUserFromCookie(w, r)
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
	log.Verbosef("importing for user: %s, email: '%s', pwd: '%s'\n", dbUser.Login, email, password)
	id := newImportStatus(dbUser.ID)
	go importSimpleNote(id, dbUser.ID, email, password)
	v := struct {
		ImportID int
	}{
		ImportID: id,
	}
	httpOkWithJSON(w, r, v)
}
