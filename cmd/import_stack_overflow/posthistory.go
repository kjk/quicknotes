package main

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// PostHistory describes history of a post
type PostHistory struct {
	ID                int
	PostHistoryTypeID int
	PostID            int
	RevisionGUID      string
	CreationDate      time.Time
	UserID            int
	UserDisplayName   string
	Text              string
	Comment           string
}

func decodePostHistoryAttr(attr xml.Attr, h *PostHistory) error {
	var err error
	name := strings.ToLower(attr.Name.Local)
	v := attr.Value
	switch name {
	case "id":
		h.ID, err = strconv.Atoi(v)
	case "posthistorytypeid":
		h.PostHistoryTypeID, err = strconv.Atoi(v)
	case "postid":
		h.PostID, err = strconv.Atoi(v)
	case "revisionguid":
		h.RevisionGUID = v
	case "creationdate":
		h.CreationDate, err = decodeTime(v)
	case "userid":
		h.UserID, err = strconv.Atoi(v)
	case "userdisplayname":
		h.UserDisplayName = v
	case "text":
		h.Text = v
	case "comment":
		h.Comment = v
	default:
		err = fmt.Errorf("unknown post history field: '%s'", name)
	}
	return err
}

func decodePostHistoryRow(t xml.Token, h *PostHistory) error {
	// have been checked before that this is "row" element
	e, _ := t.(xml.StartElement)
	for _, attr := range e.Attr {
		err := decodePostHistoryAttr(attr, h)
		if err != nil {
			return err
		}
	}
	return nil
}
