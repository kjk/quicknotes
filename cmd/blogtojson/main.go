package main

import (
	"fmt"
	"time"
)

// this programs converts my blog posts into .json format that can be
// imported into quicknotes for testing

// Note describes a note that can be imported into QuickNotes
type Note struct {
	Title        string
	Tags         []string
	IsPublic     bool
	IsDeleted    bool
	CreationTime time.Time
}

func main() {
	fmt.Printf("hello\n")
}
