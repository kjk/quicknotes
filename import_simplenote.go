package main

import (
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
	user, err := dbGetUserByLogin(kjkLogin)
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

		noteID, err := dbCreateNewNote(user.ID, &newNote)
		if err != nil {
			return err
		}
		fmt.Printf(" modTime: %s, title: '%s', noteId: %d\n", newNote.createdAt, newNote.title, noteID)
	}
	return nil
}
