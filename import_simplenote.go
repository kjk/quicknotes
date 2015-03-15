package main

import (
	"bufio"
	"compress/bzip2"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"time"
)

const (
	simplenoteLocalPath = "notes.json.bz2"
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

type noteJSON struct {
	ID               string
	Version          int
	Tags             []string
	Deleted          bool
	Content          string
	SystemTags       []string
	ModificationDate time.Time
	CreationDate     time.Time
}

func readNotes(path string) ([]*noteJSON, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	r := bzip2.NewReader(f)
	dec := json.NewDecoder(r)
	allNotes := make(map[string]*noteJSON)
	for {
		var note noteJSON
		err = dec.Decode(&note)
		if err != nil {
			break
		}
		// for now only get the latest version of each note
		curr := allNotes[note.ID]
		if curr == nil || curr.Version < note.Version {
			allNotes[note.ID] = &note
		}
	}
	if err == io.EOF {
		err = nil
	}
	if err != nil {
		log.Fatalf("readNotes: dec.Decode() failed with '%s'\n", err)
	}
	var res []*noteJSON
	for _, n := range allNotes {
		res = append(res, n)
	}
	return res, nil
}

func importSimplenote() error {
	user, err := getUserByLogin(kjkLogin)
	if err != nil {
		return err
	}

	notes, err := readNotes(simplenoteLocalPath)
	if err != nil {
		LogErrorf("readNotes('%s') failed with %s\n", simplenoteLocalPath, err)
		return err
	}

	fmt.Printf("%s: %d notes\n", simplenoteLocalPath, len(notes))
	for _, note := range notes {
		newNote := NewNote{
			format:    formatText,
			tags:      note.Tags,
			createdAt: note.CreationDate,
		}
		newNote.title, newNote.content = noteToTitleContent([]byte(note.Content))
		if len(newNote.content) == 0 {
			fmt.Printf("   skipping an empty note")
			continue
		}

		noteID, err := createNewNote(user.ID, &newNote)
		if err != nil {
			return err
		}
		fmt.Printf(" modTime: %s, title: '%s', noteId: %d\n", newNote.createdAt, newNote.title, noteID)
	}
	return nil
}
