package main

import (
	"encoding/xml"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

const (
	typBadges       = "badges"
	typeComments    = "comments"
	typePostHistory = "posthistory"
	typePostLinks   = "postlinks"
	typePosts       = "posts"
	typeTags        = "tags"
	typeUsers       = "users"
	typeVotes       = "votes"
)

// Reader is for iteratively reading records from xml file
type Reader struct {
	f        *os.File
	d        *xml.Decoder
	typ      string
	User     User
	Post     Post
	Comment  Comment
	Tag      Tag
	err      error
	finished bool
}

func isCharData(t xml.Token) bool {
	_, ok := t.(xml.CharData)
	return ok
}

func isProcInst(t xml.Token) bool {
	_, ok := t.(xml.ProcInst)
	return ok
}

func isStartElement(t xml.Token, name string) bool {
	e, ok := t.(xml.StartElement)
	if !ok {
		return false
	}
	return strings.EqualFold(e.Name.Local, name)
}

func isEndElement(t xml.Token, name string) bool {
	e, ok := t.(xml.EndElement)
	if !ok {
		return false
	}
	return strings.EqualFold(e.Name.Local, name)
}

func getTokenIgnoreCharData(d *xml.Decoder) (xml.Token, error) {
	t, err := d.Token()
	if err != nil {
		return nil, err
	}
	if !isCharData(t) {
		return t, nil
	}
	return d.Token()
}

func decodeTime(s string) (time.Time, error) {
	return time.Parse("2006-01-02T15:04:05.999999999", s)
}

// NewUsersReader returns a new reader for Users.xml file
func NewUsersReader(path string) (*Reader, error) {
	return newReader(path, typeUsers)
}

// NewPostsReader returns a new reader for Posts.xml file
func NewPostsReader(path string) (*Reader, error) {
	return newReader(path, typePosts)
}

// NewCommentsReader returns a new reader for Comments.xml file
func NewCommentsReader(path string) (*Reader, error) {
	return newReader(path, typeComments)
}

// NewTagsReader returns a new reader for Comments.xml file
func NewTagsReader(path string) (*Reader, error) {
	return newReader(path, typeTags)
}

func newReader(path string, typ string) (*Reader, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		if f != nil {
			f.Close()
		}
	}()

	r := &Reader{
		f:   f,
		d:   xml.NewDecoder(f),
		typ: typ,
	}
	t, err := getTokenIgnoreCharData(r.d)
	if err != nil {
		return nil, err
	}
	// skip <?xml ...>
	if isProcInst(t) {
		t, err = getTokenIgnoreCharData(r.d)
		if err != nil {
			return nil, err
		}
	}
	if !isStartElement(t, r.typ) {
		fmt.Printf("NewUserReader: invalid first token: %#v\n", t)
		f.Close()
		return nil, errors.New("invalid first token")
	}
	r.Next()
	if r.err != nil {
		return nil, r.err
	}
	f = nil
	return r, nil
}

// Err returns potential error
func (r *Reader) Err() error {
	return r.err
}

// Next advances to next User record. Returns false on end or
func (r *Reader) Next() bool {
	if r.err != nil || r.finished {
		return false
	}

	defer func() {
		if r.err != nil {
			r.f.Close()
			r.f = nil
		}
	}()

	// skip newlines between eleemnts
	t, err := getTokenIgnoreCharData(r.d)
	if err != nil {
		r.err = err
		return false
	}

	if isEndElement(t, "row") {
		t, r.err = getTokenIgnoreCharData(r.d)
		if r.err != nil {
			return false
		}
	}

	if isEndElement(t, r.typ) {
		r.finished = true
		return false
	}

	if !isStartElement(t, "row") {
		r.err = fmt.Errorf("unexpected token: %#v, wanted xml.StartElement 'row'", t)
		return false
	}
	switch r.typ {
	case typeUsers:
		r.err = decodeUserRow(t, &r.User)
	case typePosts:
		r.err = decodePostRow(t, &r.Post)
	case typeComments:
		r.err = decodeCommentRow(t, &r.Comment)
	case typeTags:
		r.err = decodeTagRow(t, &r.Tag)
	}
	if r.err != nil {
		return false
	}
	return true
}
