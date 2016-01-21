package main

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/kjk/log"
)

const (
	TypeTitle   = 1
	TypeLine    = 2
	TypeContext = 3

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
	NoteIDStr string
	Items     []SearchResultItem
}

// GET /api/searchusernotes
// args:
// - user : user handle
// - term : search term
// TODO: limit number of hits to some reasonable number e.g. 100?
func handleSearchUserNotes(w http.ResponseWriter, r *http.Request) {
	userHandle := strings.TrimSpace(r.FormValue("user"))
	if userHandle == "" {
		log.Errorf("missing user arg in '%s'\n", r.URL)
		http.NotFound(w, r)
		return
	}
	searchTerm := r.FormValue("term")
	if searchTerm == "" {
		log.Errorf("missing search term in '%s'\n", r.URL)
		httpServerError(w, r)
		return
	}
	loggedInUserHandle := ""
	dbUser := getUserFromCookie(w, r)
	if dbUser != nil {
		loggedInUserHandle = dbUser.Handle
	}
	searchPrivate := userHandle == loggedInUserHandle

	log.Infof("userHandle: '%s', term: '%s', private: %v, url: '%s'\n", userHandle, searchTerm, searchPrivate, r.URL)

	i, err := getCachedUserInfoByHandle(userHandle)
	if err != nil || i == nil {
		httpServerError(w, r)
		return
	}
	var notes []*Note
	for _, note := range i.notes {
		if note.IsPublic || searchPrivate {
			notes = append(notes, note)
		}
	}

	timeStart := time.Now()
	matches := searchNotes(searchTerm, notes)
	fmt.Printf("searchNotes('%s') of %d notes took %s\n", searchTerm, len(matches), time.Since(timeStart))

	var res []SearchResult
	for _, match := range matches {
		items := noteMatchToSearchResults(searchTerm, match)
		if len(items) >= maxHitsPerNote {
			items = items[:maxHitsPerNote]
		}
		sr := SearchResult{
			NoteIDStr: match.note.IDStr,
			Items:     items,
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
	httpOkWithJSONCompact(w, r, v)
}
