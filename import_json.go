package main

import (
	"compress/bzip2"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"
)

type noteJSON struct {
	Title     string
	Content   []byte
	Format    int
	Tags      []string `json:",omitempty"`
	IsPublic  bool
	IsDeleted bool
	CreatedAt time.Time
}

func importNotesFromJSON(path, userHandle string) {
	var r io.Reader
	if path == "" || userHandle == "" {
		log.Fatalf("missing path ('%s') or user handle ('%s')\n", path, userHandle)
	}
	isBlog := strings.Contains(path, "blog.json")
	dbUser, err := dbGetUserByHandle(userHandle)
	if err != nil && err != sql.ErrNoRows {
		log.Fatalf("dbGetUserByHandle() failed with '%s'\n", err)
	}
	if dbUser == nil {
		log.Fatalf("no user with handle '%s'\n", userHandle)
	}
	f, err := os.Open(path)
	if err != nil {
		log.Fatalf("os.Open('%s') failed with '%s'", path, err)
	}
	defer f.Close()
	r = f
	if strings.HasSuffix(path, ".bz2") {
		r = bzip2.NewReader(r)
	}
	dec := json.NewDecoder(r)
	nImported := 0
	for {
		var n noteJSON
		err = dec.Decode(&n)
		if err != nil {
			break
		}
		newNote := NewNote{
			title:     n.Title,
			format:    n.Format,
			content:   n.Content,
			tags:      n.Tags,
			createdAt: n.CreatedAt,
			isDeleted: n.IsDeleted,
			isPublic:  n.IsPublic,
		}
		if isBlog {
			newNote.tags = append(newNote.tags, "blog")
		}
		_, err = dbCreateNewNote(dbUser.ID, &newNote)
		if err != nil {
			log.Fatalf("dbCreateNewNote() failed with '%s'", err)
		}
		nImported++
		fmt.Printf("imported note %d, %s\n", nImported, n.Title)
	}
	if err == io.EOF {
		err = nil
	}
	if err != nil {
		log.Fatalf("dec.Decode() failed with '%s'", err)
	}
	fmt.Printf("imported %d notes\n", nImported)
}
