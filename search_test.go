package main

import "testing"

func TestSearch(t *testing.T) {
	term := "quicknotes"
	matches := searchSimpleNotes(term, maxSearchResults)
	nExp := 13
	if nExp != len(matches) {
		t.Fatalf("exp: %d matches, got %d\n", nExp, len(matches))
	}
	expIDs := []string{
		"08320c48bd7a4fce95d88c3243a8dad8",
		"cdef26411a694d06baf0addd251279c6",
		"b7bc0a62305e4b0ea26407699ada0c62",
		"13d1dcb7032a4ff3b24c4098fc97a15d",
		"b0dd700eccd947e087633755ba0dc5b2",
		"bb780afa8b33477ba14d2fb052bb4f05",
	}
	for i, expID := range expIDs {
		m := matches[i]
		n := m.note
		gotID := n.ID
		if expID != gotID {
			t.Fatalf("expected: %s, got: %s", expID, gotID)
		}
	}
	printSearchResults(term, matches)
}
