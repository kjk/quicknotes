package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/kjk/u"
)

/*
TODO: save in a file events.log-YYYY-MM-DD.json, rotate the logs daily.
*/

var (
	eventsLog *EventsLog
)

// EventsLog describes a single log with events
type EventsLog struct {
	dir      string
	file     *os.File
	enc      *json.Encoder
	currPath string
	currTime time.Time
}

func reopenEventsFileIfNeeded() error {
	var err error
	if eventsLog.file != nil {
		if eventsLog.currTime.YearDay() == time.Now().YearDay() {
			return nil
		}
	}
	path := filepath.Join(eventsLog.dir, "events.log.json")
	if eventsLog.file != nil {
		eventsLog.file.Close()
		eventsLog.file = nil
		newPath := eventsLog.currTime.Format("events.log-2006-01-02.json")
		err = os.Rename(path, newPath)
		// TODO: mark EventsLog as invalid so we don't keep logging on error?
		if err != nil {
			return err
		}
	}

	eventsLog.currTime = time.Now()
	eventsLog.file, err = os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0666)
	if err != nil {
		// TODO: mark EventsLog as invalid so we don't keep logging on error?
		return err
	}
	eventsLog.enc = json.NewEncoder(eventsLog.file)
	return nil
}

// InitEventsLogMust initializes event logging
func InitEventsLogMust(dir string) error {
	err := os.MkdirAll(dir, 0755)
	u.PanicIfErr(err)
	eventsLog = &EventsLog{
		dir: dir,
	}
	return reopenEventsFileIfNeeded()
}

// LogEvent logs another event as json
func LogEvent(v interface{}) {
	// TODO: do logging on a separate goroutine to prevent random stalls due to i/o
	err := reopenEventsFileIfNeeded()
	if err != nil {
		return
	}
	err = eventsLog.enc.Encode(v)
	if err != nil {
		log.Printf("eventsLog.enc.Encode() failed with %s\n", err)
	}
}
