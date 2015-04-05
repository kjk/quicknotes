package main

import "time"

// EventUserLogin is generated on successful/unsuccesful login
type EventUserLogin struct {
	Login string
	When  time.Time
	Ok    bool
}

// EventNoteCreated is generated when a note is createda
type EventNoteCreated struct {
	User string    // user login
	ID   int       // note id
	When time.Time // when it was created
}

// EventNoteModified is generated when a note is modified (including a deletion)
type EventNoteModified struct {
	User string    // user login
	ID   int       // note id
	When time.Time // when it was modified
}
