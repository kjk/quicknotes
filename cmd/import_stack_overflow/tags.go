package main

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
)

// Tag describes a tag
type Tag struct {
	ID            int
	TagName       string
	Count         int
	ExcerptPostID int
	WikiPostID    int
}

func decodeTagAttr(attr xml.Attr, t *Tag) error {
	var err error
	name := strings.ToLower(attr.Name.Local)
	v := attr.Value
	switch name {
	case "id":
		t.ID, err = strconv.Atoi(v)
	case "tagname":
		t.TagName = v
	case "count":
		t.Count, err = strconv.Atoi(v)
	case "excerptpostid":
		t.ExcerptPostID, err = strconv.Atoi(v)
	case "wikipostid":
		t.WikiPostID, err = strconv.Atoi(v)
	default:
		err = fmt.Errorf("unknown tag field: '%s'", name)
	}
	return err
}

func decodeTagRow(t xml.Token, tag *Tag) error {
	// have been checked before that this is "row" element
	e, _ := t.(xml.StartElement)
	for _, attr := range e.Attr {
		err := decodeTagAttr(attr, tag)
		if err != nil {
			return err
		}
	}
	return nil
}
