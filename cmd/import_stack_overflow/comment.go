package main

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Comment describes a comment
type Comment struct {
	ID              int
	PostID          int
	Score           int
	Text            string
	CreationDate    time.Time
	UserID          int
	UserDisplayName string
}

func decodeCommentAttr(attr xml.Attr, c *Comment) error {
	var err error
	name := strings.ToLower(attr.Name.Local)
	v := attr.Value
	switch name {
	case "id":
		c.ID, err = strconv.Atoi(v)
	case "postid":
		c.PostID, err = strconv.Atoi(v)
	case "score":
		c.Score, err = strconv.Atoi(v)
	case "text":
		c.Text = v
	case "creationdate":
		c.CreationDate, err = decodeTime(v)
	case "userid":
		c.UserID, err = strconv.Atoi(v)
	case "userdisplayname":
		c.UserDisplayName = v
	default:
		err = fmt.Errorf("unknown comment field: '%s'", name)
	}
	return err
}

func decodeCommentRow(t xml.Token, c *Comment) error {
	// have been checked before that this is "row" element
	e, _ := t.(xml.StartElement)
	for _, attr := range e.Attr {
		err := decodeCommentAttr(attr, c)
		if err != nil {
			return err
		}
	}
	return nil
}
