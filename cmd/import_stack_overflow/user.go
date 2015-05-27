package main

import (
	"encoding/xml"
	"fmt"
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
