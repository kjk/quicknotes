package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"

	"github.com/kjk/u"
)

/*
TODO: save in a file events.log-YYYY-MM-DD.json, rotate the logs daily.
*/

var (
	eventsLog *EventsLog
)

type EventsLog struct {
	dir  string
	file *os.File
	enc  *json.Encoder
}

func InitEventsLogMust(dir string) {
	err := os.MkdirAll(dir, 0755)
	u.PanicIfErr(err)
	eventsLog = &EventsLog{
		dir: dir,
	}
	path := filepath.Join(dir, "events.log.json")
	eventsLog.file, err = os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0666)
	u.PanicIfErr(err)
	eventsLog.enc = json.NewEncoder(eventsLog.file)
}

func LogEvent(v interface{}) {
	err := eventsLog.enc.Encode(v)
	if err != nil {
		log.Printf("eventsLog.enc.Encode() failed with %s\n", err)
	}
}
