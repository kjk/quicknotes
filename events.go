package main

import (
	"encoding/json"
	"log"
	"os"
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
	if eventsLog.file != nil {
		if eventsLog.currTime.YearDay() == time.Now().YearDay() {
			return nil
		}
	}
	/*
		path := filepath.Join(dir, "events.log.json")
		if eventsLog.file != nil {
			eventsLog.file.Close()
			eventsLog.file = nil
			newPath := eventsLog.currTime.Format("events.log-2006-01-02.json")
			err := os.Rename(path, newPath)
			if err != nil {

			}
		}

		eventsLog.currTime = time.Now()
		fileName = currTime.Format("events.")
		eventsLog.file, err = os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0666)
		if err != nil {
			return err
		}
		eventsLog.enc = json.NewEncoder(eventsLog.file)
	*/
}

func InitEventsLogMust(dir string) error {
	err := os.MkdirAll(dir, 0755)
	u.PanicIfErr(err)
	eventsLog = &EventsLog{
		dir: dir,
	}
	return reopenEventsFileIfNeeded()
}

func LogEvent(v interface{}) {
	err := eventsLog.enc.Encode(v)
	if err != nil {
		log.Printf("eventsLog.enc.Encode() failed with %s\n", err)
	}
}
