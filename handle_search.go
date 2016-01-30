package main

import (
	"net/http"
	"strings"

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
	NoteHashID string
	Items      []SearchResultItem
}

// GET /api/searchusernotes
// args:
// - user : hashed user id
// - term : search term
// TODO: limit number of hits to some reasonable number e.g. 100?
// TODO: return errors as JSON?
func handleSearchUserNotes(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	hashedUserID := strings.TrimSpace(r.FormValue("user"))
	if hashedUserID == "" {
		log.Errorf("missing 'user' arg in '%s'\n", r.URL)
		http.NotFound(w, r)
		return
	}
	userID, err := dehashInt(hashedUserID)
	if err != nil {
		log.Errorf("invalid 'user' arg '%s' in '%s', err='%s'\n", hashedUserID, r.URL, err)
	}
	searchTerm := r.FormValue("term")
	if searchTerm == "" {
		log.Errorf("missing search term in '%s'\n", r.URL)
		httpServerError(w, r)
		return
	}
	searchPrivate := ctx.User != nil && userID == ctx.User.id

	log.Verbosef("userID: '%d', term: '%s', private: %v, url: '%s'\n", userID, searchTerm, searchPrivate, r.URL)

	i, err := getCachedUserInfo(userID)
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

	timing := ctx.NewTimingf("searching %d notes for '%s'", len(notes), searchTerm)
	matches := searchNotes(searchTerm, notes)
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
	httpOkWithJSONCompact(w, r, v)
}
