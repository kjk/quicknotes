package main

import (
	"fmt"

	"github.com/kjk/quicknotes/pkg/log"
)

const (
	// TypeTitle is note title
	TypeTitle = 1
	// TypeLine is note line
	TypeLine = 2

	maxSearchResults = 48
	maxHitsPerNote   = 32
)

// SearchResultItem is a
type SearchResultItem struct {
	Type   int
	LineNo int
	HTML   string
}

// SearchResult has search results sent to client
type SearchResult struct {
	NoteHashID string
	Items      []SearchResultItem
}

func searchUserNotes(ctx *ReqContext, userIDHash string, searchTerm string) (interface{}, error) {
	if userIDHash == "" {
		return nil, fmt.Errorf("missing 'userIDHash' arg")
	}
	if searchTerm == "" {
		return nil, fmt.Errorf("missing search term")
	}

	userID, err := dehashInt(userIDHash)
	if err != nil {
		return nil, fmt.Errorf("invalid 'user' arg '%s', err='%s'", userIDHash, err)
	}
	searchPrivate := ctx.User != nil && userID == ctx.User.id

	log.Verbosef("userID: '%d', term: '%s', private: %v\n", userID, searchTerm, searchPrivate)

	i, err := getCachedUserInfo(userID)
	if err != nil {
		return nil, err
	}
	if i == nil {
		return nil, fmt.Errorf("No user with userIDHash '%s'", userIDHash)
	}
	var notes []*Note
	for _, note := range i.notes {
		if note.IsPublic || searchPrivate {
			notes = append(notes, note)
		}
	}

	timing := ctx.NewTimingf("searching %d notes for '%s'", len(notes), searchTerm)
	matches := searchNotes(searchTerm, notes, defaultMaxResults)
	timing.Finished()
	log.Verbosef("searchNotes('%s') of %d notes took %s\n", searchTerm, len(matches), timing.Duration)

	var res []SearchResult
	for _, match := range matches {
		items := noteMatchToSearchResults(searchTerm, match)
		if len(items) >= maxHitsPerNote {
			items = items[:maxHitsPerNote]
		}
		sr := SearchResult{
			NoteHashID: match.note.HashID,
			Items:      items,
		}
		res = append(res, sr)
		if len(res) >= maxSearchResults {
			break
		}
	}
	v := struct {
		Term    string
		Results []SearchResult
	}{
		Term:    searchTerm,
		Results: res,
	}
	return v, nil
}

func wsSearchUserNotes(ctx *ReqContext, args map[string]interface{}) (interface{}, error) {
	userIDHash, _ := jsonMapGetString(args, "userIDHash")
	searchTerm, _ := jsonMapGetString(args, "searchTerm")
	return searchUserNotes(ctx, userIDHash, searchTerm)
}
