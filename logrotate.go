package main

import (
	"compress/gzip"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/bradfitz/slice"
	"github.com/kjk/u"
)

// A log file that supports rotation based on size threshold

var (
	rotationLogMutex sync.RWMutex
	logToStdout      = false
)

// io.Writer that keeps track about how much data was written to it
type MeasuringWriter struct {
	Total int64
	w     io.Writer
}

func NewMeasuringWriter(w io.Writer, initialSize int64) *MeasuringWriter {
	return &MeasuringWriter{
		Total: initialSize,
		w:     w,
	}
}

func (w *MeasuringWriter) Write(p []byte) (int, error) {
	w.Total += int64(len(p))
	return w.w.Write(p)
}

type LogRotateCommon struct {
	sync.Mutex
	rotateThreshold int64
	path            string
	file            *os.File
	w               *MeasuringWriter
	useLogger       bool // setting this will log like log package: with date and time
	logger          *log.Logger
}

type LogRotate struct {
	LogRotateCommon
}

func (l *LogRotateCommon) dirAndBaseName() (string, string) {
	dir := filepath.Dir(l.path)
	base := filepath.Base(l.path)
	return dir, base
}

func (l *LogRotateCommon) close() {
	if l.file != nil {
		l.file.Close()
		l.file = nil
	}
}

func (l *LogRotateCommon) open() (err error) {
	flag := os.O_CREATE | os.O_APPEND | os.O_WRONLY
	l.file, err = os.OpenFile(l.path, flag, 0644)
	if err != nil {
		return err
	}
	stat, err := l.file.Stat()
	if err != nil {
		l.file.Close()
		return err
	}
	initialSize := stat.Size()
	l.w = NewMeasuringWriter(l.file, initialSize)
	if l.useLogger {
		l.logger = log.New(l.w, "", log.LstdFlags)
	}
	return err
}

type ArchivedFileName struct {
	name string
	n    int
}

func NewArchivedFileName(name string) *ArchivedFileName {
	// name should be in the format: foo.log.${n}.gz
	// we extract ${n} and remember it
	parts := strings.Split(name, ".")
	if len(parts) < 3 {
		return nil
	}
	n, err := strconv.Atoi(parts[len(parts)-2])
	if err != nil {
		return nil
	}
	return &ArchivedFileName{name: name, n: n}
}

const (
	MAX_ARCHIVED_TO_KEEP = 10
)

func gzipFile(path string) error {
	tmpPath := path + ".tmp"
	os.Remove(tmpPath) // just in case, shouldn't be necessary
	//fmt.Printf("gzipFile: %q\n", path)
	src, err := os.Open(path)
	if err != nil {
		fmt.Printf("gzipFile: os.Open(%q) failed with %q\n", path, err)
		return err
	}
	dst, err := os.Create(tmpPath)
	if err != nil {
		fmt.Printf("gzipFile: os.Create(%q) failed with %q\n", tmpPath, err)
		src.Close()
		return err
	}
	w := gzip.NewWriter(dst)
	_, err = io.Copy(w, src)
	if err != nil {
		fmt.Printf("gzipFile: io.Copy() failed with %q\n", err)
	}
	w.Close()
	src.Close()
	dst.Close()
	//fmt.Printf("gzipFile: removing %q\n", path)
	if err2 := os.Remove(path); err2 != nil {
		fmt.Printf("gzipFile: os.Remove(%q) failed with %q\n", path, err2)
		if err == nil {
			err = err2
		}
	} else {
		if err2 := os.Rename(tmpPath, path); err2 != nil {
			fmt.Printf("gzipFile: os.Rename(%q, %q) failed with %q\n", tmpPath, path, err2)
			if err == nil {
				err = err2
			}
		}
	}
	return err
}

func gzipFileUnderMutex(path string) {
	rotationLogMutex.RLock()
	gzipFile(path)
	rotationLogMutex.RUnlock()
}

func WaitAllLogRotationsToFinish() {
	// gzipFileUnderMutex() takes read lock so trying to lock for writing waits
	// for them all to fnish. at this point there should be no new
	// gzipFileUnderMutex calls issued
	rotationLogMutex.Lock()
	rotationLogMutex.Unlock()
}

func (l *LogRotateCommon) shouldRotate() bool {
	return l.w.Total >= l.rotateThreshold
}

func (l *LogRotateCommon) rotate() bool {
	//fmt.Printf("LogRotateCommon.rotateIfNeeded: will rotate because Total > rotateThreshold (%d > %d)\n", l.w.Total, l.rotateThreshold)
	// log file is $dir/foo.log
	// we rotate to $dir/foo.log.$n.gz and keep last N
	dir, baseName := l.dirAndBaseName()
	allFiles, err := ioutil.ReadDir(dir)
	archived := make([]*ArchivedFileName, 0)
	for _, fi := range allFiles {
		name := fi.Name()
		if !strings.HasPrefix(name, baseName) {
			continue
		}
		if !strings.HasSuffix(name, ".gz") {
			continue
		}
		if rf := NewArchivedFileName(name); rf != nil {
			archived = append(archived, rf)
		}
	}
	newN := 1
	if len(archived) > 0 {
		slice.Sort(archived, func(i, j int) bool {
			return archived[i].n < archived[j].n
		})
		last := archived[len(archived)-1]
		newN = last.n + 1
		toDelete := len(archived) - MAX_ARCHIVED_TO_KEEP
		for i := 0; i < toDelete; i++ {
			path := filepath.Join(dir, archived[i].name)
			err := os.Remove(path)
			if err != nil {
				fmt.Printf("LogRotateCommon.rotateIfNeeded: os.Remove(%q) failed with %q\n", path, err)

			}
			//fmt.Printf("LogRotateCommon.rotateIfNeeded: removed %q, err=%q\n", path, err)
		}
	}
	if newN > 999 {
		newN = 1
	}
	archivedName := fmt.Sprintf("%s.%d.gz", baseName, newN)
	archivedPath := filepath.Join(dir, archivedName)
	err = os.Rename(l.path, archivedPath)
	if err != nil {
		fmt.Printf("LogRotateCommon.rotateIfNeeded: os.Rename(%q, %q) failed with %q\n", l.path, archivedPath, err)
		os.Remove(l.path)
	} else {
		// do in background so we can allow writing
		go gzipFileUnderMutex(archivedPath)
	}
	return true
}

func NewLogRotate(path string, rotateThreshold int64) (*LogRotate, error) {
	res := &LogRotate{
		LogRotateCommon{
			rotateThreshold: rotateThreshold,
			path:            path,
			useLogger:       true,
		},
	}
	if err := res.open(); err != nil {
		return nil, err
	}
	return res, nil
}

func (l *LogRotate) rotateIfNeeded() {
	if !l.shouldRotate() {
		return
	}
	l.close()
	l.rotate()
	l.open()
}

func (l *LogRotate) Close() {
	if l == nil {
		return
	}
	l.Lock()
	l.close()
	l.Unlock()
}

func (l *LogRotate) Print(s string) {
	if logToStdout {
		fmt.Print(s)
	}
	if l == nil {
		return
	}
	if l.logger != nil {
		l.logger.Print(s)
	} else {
		l.w.Write([]byte(s))
	}
	l.rotateIfNeeded()
}

func (l *LogRotate) Printf(format string, arg ...interface{}) {
	l.Print(fmt.Sprintf(format, arg...))
}

func testLog() {
	l, err := NewLogRotate("test.log", 128*10*4)
	u.PanicIf(err != nil, "err: %q", err)
	for i := 0; i < 1024; i++ {
		l.Print("msg: ")
		l.Printf("this is line %d\n", i)
	}
	l.Close()
	WaitAllLogRotationsToFinish()
}
