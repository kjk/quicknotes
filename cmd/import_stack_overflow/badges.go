package main

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Badge tells which badge a given user has
type Badge struct {
	ID     int
	UserID int
	Name   string
	Date   time.Time
}

func decodeBadgeAttr(attr xml.Attr, b *Badge) error {
	var err error
	name := strings.ToLower(attr.Name.Local)
	v := attr.Value
	switch name {
	case "id":
		b.ID, err = strconv.Atoi(v)
	case "userid":
		b.UserID, err = strconv.Atoi(v)
	case "name":
		b.Name = v
	case "date":
		b.Date, err = decodeTime(v)
	default:
		err = fmt.Errorf("unknown badge field: '%s'", name)
	}
	return err
}

func decodeBadgeRow(t xml.Token, b *Badge) error {
	// have been checked before that this is "row" element
	e, _ := t.(xml.StartElement)
	for _, attr := range e.Attr {
		err := decodeBadgeAttr(attr, b)
		if err != nil {
			return err
		}
	}
	return nil
}
