package main

import "testing"

func TestSearch(t *testing.T) {
	term := "quicknotes"
	matches := searchSimpleNotes(term)
	nExp := 13
	if nExp != len(matches) {
		t.Fatalf("exp: %d matches, got %d\n", nExp, len(matches))
	}
	printSearchResults(term, matches)
}
