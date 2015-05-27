package main

import (
	"encoding/xml"
	"errors"
	"fmt"
	"os"
)

const (
	typeUser = "users"
	typePost = "posts"
)

// Reader is for iteratively reading records from xml file
type Reader struct {
	f        *os.File
	d        *xml.Decoder
	typ      string
	User     User
	Post     Post
	err      error
	finished bool
}

// NewUserReader returns a new reader for User.xml file
func NewUserReader(path string) (*Reader, error) {
	return newReader(path, typeUser)
}

// NewPostReader returns a new reader for Post.xml file
func NewPostReader(path string) (*Reader, error) {
	return newReader(path, typePost)
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
	case typeUser:
		r.err = decodeUserRow(t, &r.User)
	case typePost:
		r.err = decodePostRow(t, &r.Post)
	}
	if r.err != nil {
		return false
	}
	return true
}
