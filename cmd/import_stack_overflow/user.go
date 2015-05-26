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

func decodeUserAttr(attr xml.Attr, u *User) error {
	var err error
	name := strings.ToLower(attr.Name.Local)
	v := attr.Value
	switch name {
	case "id":
		u.ID, err = strconv.Atoi(v)
	case "reputation":
		u.Reputation, err = strconv.Atoi(v)
	case "creationdate":
		u.CreationDate, err = decodeTime(v)
	case "displayname":
		u.DisplayName = v
	case "lastaccessdate":
		u.LastAccessDate, err = decodeTime(v)
	case "websiteurl":
		u.WebsiteURL = v
	case "location":
		u.Location = v
	case "aboutme":
		u.AboutMe = v
	case "views":
		u.Views, err = strconv.Atoi(v)
	case "upvotes":
		u.UpVotes, err = strconv.Atoi(v)
	case "downvotes":
		u.DownVotes, err = strconv.Atoi(v)
	case "accountid":
		u.AccountID, err = strconv.Atoi(v)
	case "age":
		u.Age, err = strconv.Atoi(v)
	case "profileimageurl":
		u.ProfileImageURL = v
	default:
		err = fmt.Errorf("unknown field %s", name)
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

// UserReader is for iteratively reading User
type UserReader struct {
	f        *os.File
	d        *xml.Decoder
	User     User
	err      error
	finished bool
}

// NewUserReader returns a new reader for User.xml file
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
