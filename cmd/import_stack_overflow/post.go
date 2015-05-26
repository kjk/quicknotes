package main

import (
	"encoding/xml"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	// PostTypeQuestion denotes a post that is a question
	PostTypeQuestion = 1
	// PostTypeAnswer denotes a post that is an answer
	PostTypeAnswer = 2
	// PostTypeUnknown1 denotes a post whose type I don't understand
	// Is it a tag description?
	PostTypeUnknown1 = 4
	// PostTypeUnknown2 denotes a post whose type I don't understand
	PostTypeUnknown2 = 5
	// PostTypeUnknown3 denotes a post whose type I don't understand
	// Is it site description?
	PostTypeUnknown3 = 6
	// PostTypeUnknown4 denotes a post whose type I don't understand
	// Is it site description?
	PostTypeUnknown4 = 7
)

// Post describes a post
type Post struct {
	ID                    int
	PostTypeID            int
	ParentID              int // for PostTypeAnswer
	AcceptedAnswerID      int
	CreationDate          time.Time
	Score                 int
	ViewCount             int
	Body                  string
	OwnerUserID           int
	OwnerDisplayName      string
	LastEditorUserID      int
	LastEditorDisplayName string
	LastEditDate          time.Time
	LastActivitityDate    time.Time
	Title                 string
	Tags                  []string
	AnswerCount           int
	CommentCount          int
	FavoriteCount         int
	CommunityOwnedDate    time.Time
	ClosedDate            time.Time
}

var nTagsToShow = 0

func decodeTags(s string) ([]string, error) {
	// tags are in the format: <foo><bar>
	s = strings.TrimPrefix(s, "<")
	s = strings.TrimSuffix(s, ">")
	tags := strings.Split(s, "><")
	if nTagsToShow > 0 {
		nTagsToShow--
		fmt.Printf("tags: '%s' => %v\n", s, tags)
	}
	return tags, nil
}

func decodePostAttr(attr xml.Attr, p *Post) error {
	var err error
	name := strings.ToLower(attr.Name.Local)
	v := attr.Value
	switch name {
	case "id":
		p.ID, err = strconv.Atoi(v)
	case "parentid":
		p.ParentID, err = strconv.Atoi(v)
	case "posttypeid":
		p.PostTypeID, err = strconv.Atoi(v)
	case "acceptedanswerid":
		p.AcceptedAnswerID, err = strconv.Atoi(v)
	case "creationdate":
		p.CreationDate, err = decodeTime(v)
	case "score":
		p.Score, err = strconv.Atoi(v)
	case "viewcount":
		p.ViewCount, err = strconv.Atoi(v)
	case "body":
		p.Body = v
	case "owneruserid":
		p.OwnerUserID, err = strconv.Atoi(v)
	case "ownerdisplayname":
		p.OwnerDisplayName = v
	case "lasteditoruserid":
		p.LastEditorUserID, err = strconv.Atoi(v)
	case "lasteditordisplayname":
		p.LastEditorDisplayName = v
	case "lasteditdate":
		p.LastEditDate, err = decodeTime(v)
	case "lastactivitydate":
		p.LastActivitityDate, err = decodeTime(v)
	case "title":
		p.Title = v
	case "tags":
		p.Tags, err = decodeTags(v)
	case "answercount":
		p.AnswerCount, err = strconv.Atoi(v)
	case "commentcount":
		p.CommentCount, err = strconv.Atoi(v)
	case "favoritecount":
		p.FavoriteCount, err = strconv.Atoi(v)
	case "communityowneddate":
		p.CommunityOwnedDate, err = decodeTime(v)
	case "closeddate":
		p.ClosedDate, err = decodeTime(v)
	default:
		err = fmt.Errorf("unknown field %s", name)
	}
	return err
}

func validatePost(p *Post) {
	switch p.PostTypeID {
	case 1, 2, 4, 5, 6, 7:
		// do nothing, valid types
	default:
		log.Fatalf("invalid PostTypeID: %d\n", p.PostTypeID)
	}
}

func decodePostRow(t xml.Token, p *Post) error {
	// have been checked before that this is "row" element
	e, _ := t.(xml.StartElement)
	for _, attr := range e.Attr {
		err := decodePostAttr(attr, p)
		if err != nil {
			return err
		}
	}
	validatePost(p)
	return nil
}

// PostReader is for iteratively reading Post
type PostReader struct {
	f        *os.File
	d        *xml.Decoder
	Post     Post
	err      error
	finished bool
}

// NewPostReader returns a new reader for Post.xml file
func NewPostReader(path string) (*PostReader, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		if f != nil {
			f.Close()
		}
	}()

	r := &PostReader{
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
	if !isStartElement(t, "posts") {
		fmt.Printf("PostReader: invalid first token: %#v\n", t)
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
func (r *PostReader) Err() error {
	return r.err
}

// Next advances to next User record. Returns false on end or
func (r *PostReader) Next() bool {
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

	if isEndElement(t, "posts") {
		r.finished = true
		return false
	}

	if !isStartElement(t, "row") {
		r.err = fmt.Errorf("unexpected token: %#v, wanted xml.StartElement 'row'", t)
		return false
	}
	r.err = decodePostRow(t, &r.Post)
	if r.err != nil {
		return false
	}
	return true
}
