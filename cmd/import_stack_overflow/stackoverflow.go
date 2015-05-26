package main

import (
	"encoding/xml"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// User describes a user
type User struct {
	ID              int
	Reputation      int
	CreationDate    time.Time
	DisplayName     string
	LastAccessDate  time.Time
	WebsiteURL      string
	Location        string
	AboutMe         string
	Views           int
	UpVotes         int
	DownVotes       int
	Age             int
	AccountID       int
	ProfileImageURL string
}

// Post describes a post
type Post struct {
}

// Comment describes a comment
type Comment struct {
}

// Tag describes a tag
type Tag struct {
}

// UserReader is for iteratively reading User
type UserReader struct {
	f        *os.File
	d        *xml.Decoder
	User     User
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
	return time.Now(), nil
}

func decodeUserAttr(attr xml.Attr, u *User) error {
	var err error
	name := strings.ToLower(attr.Name.Local)
	switch name {
	case "id":
		u.ID, err = strconv.Atoi(attr.Value)
	case "reputation":
		u.Reputation, err = strconv.Atoi(attr.Value)
	case "creationdate":
		u.CreationDate, err = decodeTime(attr.Value)
	case "displayname":
		u.DisplayName = attr.Value
	case "lastaccessdate":
		u.LastAccessDate, err = decodeTime(attr.Value)
	case "websiteurl":
		u.WebsiteURL = attr.Value
	case "location":
		u.Location = attr.Value
	case "aboutme":
		u.AboutMe = attr.Value
	case "views":
		u.Views, err = strconv.Atoi(attr.Value)
	case "upvotes":
		u.UpVotes, err = strconv.Atoi(attr.Value)
	case "downvotes":
		u.DownVotes, err = strconv.Atoi(attr.Value)
	case "accountid":
		u.AccountID, err = strconv.Atoi(attr.Value)
	case "age":
		u.Age, err = strconv.Atoi(attr.Value)
	case "profileimageurl":
		u.ProfileImageURL = attr.Value
	default:
		err = fmt.Errorf("unknown field %s", attr.Name)
	}
	return err
}

func decodeUserRow(t xml.Token, u *User) error {
	// have been checked before that this is "row" element
	e, _ := t.(xml.StartElement)
	for _, attr := range e.Attr {
		err := decodeUserAttr(attr, u)
		if err != nil {
			return err
		}
	}
	return nil
}

// NewUserReader returns a new reader for .xml file
func NewUserReader(path string) (*UserReader, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		if f != nil {
			f.Close()
		}
	}()

	r := &UserReader{
		f: f,
		d: xml.NewDecoder(f),
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
	if !isStartElement(t, "users") {
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
func (r *UserReader) Err() error {
	return r.err
}

// Next advances to next User record. Returns false on end or
func (r *UserReader) Next() bool {
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

	if isEndElement(t, "users") {
		r.finished = true
		return false
	}

	if !isStartElement(t, "row") {
		r.err = fmt.Errorf("unexpected token: %#v, wanted xml.StartElement 'row'", t)
		return false
	}
	r.err = decodeUserRow(t, &r.User)
	if r.err != nil {
		return false
	}
	return true
}
