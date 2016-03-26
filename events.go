package main

import (
	"encoding/json"
	"path/filepath"
	"time"

	"github.com/kjk/log"
)

var (
	eventsLog    *log.DailyRotateFile
	eventsLogEnc *json.Encoder
)

// EventUserLogin is generated on successful/unsuccesful login
type EventUserLogin struct {
	UserID int
	When   time.Time
	Ok     bool
}

// EventNoteCreated is generated when a note is createda
type EventNoteCreated struct {
	UserID int       // user id
	ID     int       // note id
	When   time.Time // when it was created
}

// EventNoteModified is generated when a note is modified (including a deletion)
type EventNoteModified struct {
	UserID int       // user id
	ID     int       // note id
	When   time.Time // when it was modified
}

func initEventsLogMust() {
	pathFormat := filepath.Join(getLogDir(), "2006-01-02-events.json")
	eventsLog, err := log.NewDailyRotateFile(pathFormat)
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
