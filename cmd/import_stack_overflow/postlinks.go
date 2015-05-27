package main

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// PostLink describes links in a post
type PostLink struct {
	ID            int
	CreationDate  time.Time
	PostID        int
	RelatedPostID int
	LinkTypeID    int
}

func decodePostLinkAttr(attr xml.Attr, l *PostLink) error {
	var err error
	name := strings.ToLower(attr.Name.Local)
	v := attr.Value
	switch name {
	case "id":
		l.ID, err = strconv.Atoi(v)
	case "postid":
		l.PostID, err = strconv.Atoi(v)
	case "relatedpostid":
		l.RelatedPostID, err = strconv.Atoi(v)
	case "linktypeid":
		l.LinkTypeID, err = strconv.Atoi(v)
	case "creationdate":
		l.CreationDate, err = decodeTime(v)
	default:
		err = fmt.Errorf("unknown post link field: '%s'", name)
	}
	return err
}

func decodePostLinkRow(t xml.Token, l *PostLink) error {
	// have been checked before that this is "row" element
	e, _ := t.(xml.StartElement)
	for _, attr := range e.Attr {
		err := decodePostLinkAttr(attr, l)
		if err != nil {
			return err
		}
	}
	return nil
}
