package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/kjk/log"
)

// DayStat record number of events in a given day
type DayStat struct {
	Day   int
	Count int
}

// RefererDailyStat records stats for a given referer
type RefererDailyStat struct {
	Referer  string
	Total    int
	DayStats []DayStat
}

func getHTTPLogFiles() []string {
	dir := getLogDir()
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		log.Errorf("ioutil.ReadDir('%s') failed with '%s'\n", dir, err)
		return nil
	}
	var res []string
	for _, fi := range files {
		name := fi.Name()
		if strings.HasSuffix(name, "-http.txt") {
			path := filepath.Join(dir, name)
			res = append(res, path)
		}
	}
	return res
}

// HTTPLogProcessor is a helper for iterating over http log
type HTTPLogProcessor struct {
	path      string
	file      *os.File
	csvReader *csv.Reader
	current   HTTPLogRecord
	err       error
}

// HTTPLogRecord is info about a single line in http log
// TODO: more fields
type HTTPLogRecord struct {
	Time         time.Time
	URI          string
	IP           string
	Referer      string
	Code         int
	BytesWritten int
	UserID       int
	Duration     time.Duration
}

// NewHTTPLogProcessor opens http log file for processing
func NewHTTPLogProcessor(path string) (*HTTPLogProcessor, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	csvReader := csv.NewReader(f)
	res := &HTTPLogProcessor{
		path:      path,
		file:      f,
		csvReader: csvReader,
	}
	return res, nil
}

func parseInt64(s string, err *error) int64 {
	n, err2 := strconv.ParseInt(s, 10, 64)
	if err2 != nil && *err != nil {
		*err = err2
	}
	return n
}

func parseInt(s string, err *error) int {
	n, err2 := strconv.Atoi(s)
	if err2 != nil && *err != nil {
		*err = err2
	}
	return n
}

// Next returns next record in http log
// Returning nil without error means no more records
func (p *HTTPLogProcessor) Next() (*HTTPLogRecord, error) {
	if p.err != nil {
		return nil, p.err
	}
	rec, err := p.csvReader.Read()
	if err == nil && len(rec) != 8 {
		err = fmt.Errorf("invalid line, expected 8 fields, got %d", len(rec))
	}
	if err != nil {
		if err == io.EOF {
			err = nil
		}
		p.err = err
		return nil, err
	}
	res := &p.current
	timeSecs := parseInt64(rec[0], &err)
	res.Time = time.Unix(timeSecs, 0)
	res.URI = rec[1]
	res.IP = rec[2]
	res.Referer = rec[3]
	res.Code = parseInt(rec[4], &err)
	res.BytesWritten = parseInt(rec[5], &err)
	res.UserID = parseInt(rec[6], &err)
	return res, err
}

// Close closes log file
func (p *HTTPLogProcessor) Close() error {
	var err error
	if p.file != nil {
		err = p.file.Close()
		p.file = nil
	}
	return err
}

func addRefererStat(stat *RefererDailyStat, day int) {
	stat.Total++
	for i, ds := range stat.DayStats {
		if ds.Day == day {
			stat.DayStats[i].Count++
			return
		}
	}
	ds := DayStat{
		Day:   day,
		Count: 1,
	}
	stat.DayStats = append(stat.DayStats, ds)
}

func doRefererStats() {
	refererToStat := make(map[string]*RefererDailyStat)
	files := getHTTPLogFiles()
	for _, path := range files {
		p, err := NewHTTPLogProcessor(path)
		if err != nil {
			log.Errorf("NewHTTPLogProcessor('%s') failed with '%s'\n", path, err)
			continue
		}
		for {
			r, err := p.Next()
			if err != nil {
				log.Errorf("p.Next() failed with '%s'\n", err)
				break
			}
			if r == nil {
				break
			}
			day := 366*r.Time.Day() + r.Time.YearDay()
			stat := refererToStat[r.Referer]
			if stat == nil {
				stat = &RefererDailyStat{
					Referer: r.Referer,
				}
				refererToStat[r.Referer] = stat
			}
			addRefererStat(stat, day)
		}
		p.Close()
	}
	// TODO: generate summary
}
