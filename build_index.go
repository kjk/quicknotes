package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/kjk/quicknotes/pkg/log"
)

const (
	nNotesPerPage = 100
)

var (
	buildIndexMu sync.Mutex
)

// NoteIndex represents a note on the notes index page
type NoteIndex struct {
	URL             string
	Title           string
	Creator         string
	CreatedAt       time.Time
	CreatedAtString string
}

func notesIndexPagePath(pageNo int) string {
	name := fmt.Sprintf("public-notes-index-%d.html", pageNo)
	return pathForFileInCache(name)
}

func deleteIndexPages() {
	d := getCacheDir()
	files, err := ioutil.ReadDir(d)
	if err != nil {
		log.Errorf("ioutil.Read('%s') failed with '%s'\n", d, err)
		return
	}
	for _, file := range files {
		name := file.Name()
		if strings.HasPrefix(name, "public-notes-index-") {
			path := filepath.Join(d, name)
			err = os.Remove(path)
			if err != nil {
				log.Errorf("os.Remove('%s') failed with '%s'\n", path, err)
			}
		}
	}
}

func buildNotesIndexPage(nNotes, nPages, pageNo int, notes []NoteIndex) error {
	if len(notes) == 0 {
		return nil
	}
	v := struct {
		NumNotes   int
		NumPages   int
		PageNo     int
		Notes      []NoteIndex
		NextPageNo int
	}{
		NumNotes:   nNotes,
		NumPages:   nPages,
		PageNo:     pageNo,
		Notes:      notes,
		NextPageNo: 0,
	}
	if pageNo != nPages {
		v.NextPageNo = pageNo + 1
	}
	path := notesIndexPagePath(pageNo)
	err := serveTemplateFile(path, tmplNotesIndex, v)
	if err != nil {
		return err
	}
	path = path + ".gz"
	return serveTemplateFile(path, tmplNotesIndex, v)
}

// unconditionally generate index page for public notes
func buildPublicNotesIndex() error {
	log.Verbosef("buildPublicNotesIndex\n")

	buildIndexMu.Lock()
	defer buildIndexMu.Unlock()

	timeStart := time.Now()
	deleteIndexPages()
	pageNo := 1
	nNotes := 0
	db := getDbMust()

	q := `
SELECT count(*)
FROM notes
WHERE is_public = true AND is_deleted = false AND is_encrypted = false`

	err := db.QueryRow(q).Scan(&nNotes)
	if err != nil {
		log.Errorf("row.Scan() for '%s' failed with '%s'\n", q, err)
		return err
	}

	nPages := nNotes / nNotesPerPage
	if nNotes%nNotesPerPage != 0 {
		nPages++
	}

	q = `
SELECT
  id,
  user_id,
  created_at,
  title
FROM notes
WHERE is_public = true AND is_deleted = false AND is_encrypted = false
ORDER BY created_at DESC`
	rows, err := db.Query(q)
	if err != nil {
		log.Errorf("db.Query('%s') failed with '%s'\n", q, err)
		return err
	}
	defer rows.Close()
	var notes []NoteIndex
	for rows.Next() {
		var noteID int
		var userID int
		var createdAt time.Time
		var title string
		err = rows.Scan(
			&noteID,
			&userID,
			&createdAt,
			&title)
		if err != nil {
			return err
		}
		url := "/n/" + hashInt(noteID)
		if title == "" {
			title = hashInt(noteID)
		} else {
			url = url + "-" + title
		}
		userInfo, err := getCachedUserInfo(userID)
		creator := "unknown"
		if userInfo != nil {
			creator = userInfo.user.GetHandle()
		}
		notes = append(notes, NoteIndex{
			URL:             url,
			Title:           title,
			Creator:         creator,
			CreatedAt:       createdAt,
			CreatedAtString: createdAt.Format("2006-01-02"),
		})
		if len(notes) == nNotesPerPage {
			err = buildNotesIndexPage(nNotes, nPages, pageNo, notes)
			if err != nil {
				log.Errorf("buildNotesIndexPage() failed with '%s'\n", err)
				return err
			}
			pageNo++
			notes = nil
		}
		nNotes++
	}
	err = buildNotesIndexPage(nNotes, nPages, pageNo, notes)
	if err != nil {
		log.Errorf("buildNotesIndexPage() failed with '%s'\n", err)
		return err
	}
	dur := time.Since(timeStart)
	log.Verbosef("buildPublicNotesIndex, %d notes, %d pages, took %s\n", nNotes, pageNo, dur)
	return nil
}
