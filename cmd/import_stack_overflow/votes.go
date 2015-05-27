package main

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// TODO: describe VoteTypeID

// Vote describes a vote
type Vote struct {
	ID           int
	PostID       int
	VoteTypeID   int
	UserID       int
	BountyAmount int
	CreationDate time.Time
}

func decodeVoteAttr(attr xml.Attr, vote *Vote) error {
	var err error
	name := strings.ToLower(attr.Name.Local)
	v := attr.Value
	switch name {
	case "id":
		vote.ID, err = strconv.Atoi(v)
	case "postid":
		vote.PostID, err = strconv.Atoi(v)
	case "userid":
		vote.UserID, err = strconv.Atoi(v)
	case "votetypeid":
		vote.VoteTypeID, err = strconv.Atoi(v)
	case "bountyamount":
		vote.BountyAmount, err = strconv.Atoi(v)
	case "creationdate":
		vote.CreationDate, err = decodeTime(v)
	default:
		err = fmt.Errorf("unknown vote field: '%s'", name)
	}
	return err
}

func decodeVoteRow(t xml.Token, vote *Vote) error {
	// have been checked before that this is "row" element
	e, _ := t.(xml.StartElement)
	for _, attr := range e.Attr {
		err := decodeVoteAttr(attr, vote)
		if err != nil {
			return err
		}
	}
	return nil
}
