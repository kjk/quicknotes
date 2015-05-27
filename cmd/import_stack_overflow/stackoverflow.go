package main

import (
	"encoding/xml"

	"strings"
	"time"
)

// Comment describes a comment
type Comment struct {
}

// Tag describes a tag
type Tag struct {
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
