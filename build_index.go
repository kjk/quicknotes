package main

import (
	"fmt"
	"time"

	"github.com/kjk/log"
)

const (
	nNotesPerPage = 100
)

// NoteIndex represents a note on the notes index page
type NoteIndex struct {
	URL       string
	Title     string
	CreatedAt time.Time
}

func notesIndexPagePath(pageNo int) string {
	name := fmt.Sprintf("public-notes-index-%d.html", pageNo)
	return pathForFileInCache(name)
}

func buildNotesIndexPage(pageNo int, notes []NoteIndex) error {
	if len(notes) == 0 {
		return nil
	}
	v := struct {
		PageNo     int
		Notes      []NoteIndex
		NextPageNo int
	}{
		PageNo:     pageNo,
		Notes:      notes,
		NextPageNo: 0,
	}
	// doesn't work if number of notes is exactly nNotesPerPage * N
	if len(notes) == nNotesPerPage {
		v.NextPageNo = pageNo + 1
	}
	path := notesIndexPagePath(pageNo)
	err := execTemplateFile(path, tmplNotesIndex, v)
	if err != nil {
		return err
	}
	path = path + ".gz"
	return execTemplateFile(path, tmplNotesIndex, v)
}

// unconditionally generate index page for public notes
func buildPublicNotesIndex() error {
	log.Verbosef("buildPublicNotesIndex\n")
	timeStart := time.Now()
	pageNo := 1
	nNotes := 0
	db := getDbMust()
	q := `
SELECT
  id,
  created_at,
  title
FROM notes
WHERE is_public = true AND is_deleted = false AND is_encrypted = false
ORDER BY id DESC`
	rows, err := db.Query(q)
	if err != nil {
		log.Errorf("db.Query('%s') failed with %s\n", q, err)
		return err
	}
	var notes []NoteIndex
	for rows.Next() {
		var noteID int
		var createdAt time.Time
		var title string
		err := rows.Scan(
			&noteID,
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
		notes = append(notes, NoteIndex{
			URL:       url,
			Title:     title,
			CreatedAt: createdAt,
		})
		if len(notes) == nNotesPerPage {
			err = buildNotesIndexPage(pageNo, notes)
			if err != nil {
				log.Errorf("buildNotesIndexPage() failed with '%s'\n", err)
				return err
			}
			pageNo++
			notes = nil
		}
		nNotes++
	}
	err = buildNotesIndexPage(pageNo, notes)
	if err != nil {
		log.Errorf("buildNotesIndexPage() failed with '%s'\n", err)
		return err
	}
	dur := time.Since(timeStart)
	log.Verbosef("buildPublicNotesIndex, %d notes, %d pages, took %s\n", nNotes, pageNo, dur)
	return nil
}
