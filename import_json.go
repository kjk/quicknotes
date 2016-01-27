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
	Format    string
	Tags      []string `json:",omitempty"`
	IsPublic  bool
	IsDeleted bool
	CreatedAt time.Time
}

func noteJSONToNewNote(n *noteJSON) NewNote {
	res := NewNote{
		title:     n.Title,
		format:    n.Format,
		content:   n.Content,
		tags:      n.Tags,
		createdAt: n.CreatedAt,
		isDeleted: n.IsDeleted,
		isPublic:  n.IsPublic,
	}
	return res
}

// userLogin is "twitter:kjk"
func importNotesFromJSON(path, userLogin string) {
	var r io.Reader
	if path == "" || userLogin == "" {
		log.Fatalf("missing path ('%s') or user handle ('%s')\n", path, userLogin)
	}
	isBlog := strings.Contains(path, "blog.json")
	dbUser, err := dbGetUserByLogin(userLogin)
	if err != nil && err != sql.ErrNoRows {
		log.Fatalf("dbGetUserByLogin() failed with '%s'\n", err)
	}
	if dbUser == nil {
		log.Fatalf("no user with handle '%s'\n", userLogin)
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
		newNote := noteJSONToNewNote(&n)
		if isBlog {
			newNote.tags = append(newNote.tags, "blog")
		}
		_, err = dbCreateOrUpdateNote(dbUser.ID, &newNote)
		if err != nil {
			log.Fatalf("dbCreateOrUpdateNote() failed with '%s'", err)
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
