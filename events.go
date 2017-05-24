package main

import (
	"encoding/json"
	"path/filepath"

	"github.com/kjk/quicknotes/pkg/log"
)

const (
	eventUserLogin    = "ul"
	eventNoteCreated  = "nc"
	eventNoteModified = "nm"
)

var (
	eventsLog    *log.DailyRotateFile
	eventsLogEnc *json.Encoder
)

// EventUserLogin is generated on successful/unsuccesful login
type EventUserLogin struct {
	Type   string `json:"tp"`
	UserID int    `json:"ui"`
	When   int64  `json:"t"`
}

// EventNoteCreated is generated when a note is createda
type EventNoteCreated struct {
	Type   string `json:"tp"`
	UserID int    `json:"ui"`
	NoteID int    `json:"ni"`
	When   int64  `json:"t"`
}

// EventNoteModified is generated when a note is modified (including a deletion)
type EventNoteModified struct {
	Type   string `json:"tp"`
	UserID int    `json:"ui"`
	NoteID int    `json:"ni"`
	When   int64  `json:"t"`
}

func initEventsLogMust() {
	var err error
	pathFormat := filepath.Join(getLogDir(), "2006-01-02-events.json")
	eventsLog, err = log.NewDailyRotateFile(pathFormat)
	fatalIfErr(err, "initEventsLogMust")
	eventsLogEnc = json.NewEncoder(eventsLog)
}

func logEvent(v interface{}) {
	err := eventsLogEnc.Encode(v)
	if err != nil {
		log.Errorf("eventsLogEnc.Encode() failed with %s\n", err)
	}
	err = eventsLog.Flush()
	if err != nil {
		log.Errorf("eventsLog.Flush() failed with %s\n", err)
	}
}

func logEventUserLogin(userID int) {
	e := EventUserLogin{
		Type:   eventUserLogin,
		UserID: userID,
		When:   utcNowUnix(),
	}
	logEvent(&e)
}

func logEventNoteCreated(userID, noteID int) {
	e := EventNoteCreated{
		Type:   eventNoteCreated,
		UserID: userID,
		NoteID: noteID,
		When:   utcNowUnix(),
	}
	logEvent(&e)
}

func logEventNoteModified(userID, noteID int) {
	e := EventNoteModified{
		Type:   eventNoteModified,
		UserID: userID,
		NoteID: noteID,
		When:   utcNowUnix(),
	}
	logEvent(&e)
}
