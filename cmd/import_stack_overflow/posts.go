package main

import (
	"encoding/xml"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"
)

const (
	// PostTypeQuestion denotes a post that is a question
	PostTypeQuestion = 1
	// PostTypeAnswer denotes a post that is an answer
	PostTypeAnswer = 2
	// PostType3 denotes a post whose type I don't understand
	PostType3 = 3
	// PostTypeExcerpt denotes an excerpt post.
	// It could be tag description post.
	PostTypeExcerpt = 4
	// PostTypeWiki denotes a wiki post
	PostTypeWiki = 5
	// PostType6 denotes a post whose type I don't understand
	// Is it site description?
	PostType6 = 6
	// PostType7 denotes a post whose type I don't understand
	// Is it site description?
	PostType7 = 7
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
		err = fmt.Errorf("unknown post field: '%s'", name)
	}
	return err
}

func validatePost(p *Post) {
	if p.PostTypeID < 1 || p.PostTypeID > 7 {
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
