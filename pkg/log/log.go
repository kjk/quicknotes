package log

import (
	"bytes"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

var (
	logInfo  *DailyRotateFile
	logError *DailyRotateFile

	dot       = []byte(".")
	centerDot = []byte("·")

	// LogToStdout tells to log to stdout if true
	LogToStdout    bool
	verbosityLevel int32
)

// DailyRotateFile describes a file that gets rotated daily
type DailyRotateFile struct {
	sync.Mutex
	pathFormat string

	// info about currently opened file
	day  int
	path string
	file *os.File
}

func (f *DailyRotateFile) close() error {
	var err error
	if f.file != nil {
		err = f.file.Close()
		f.file = nil
	}
	return err
}

func (f *DailyRotateFile) open() error {
	t := time.Now()
	f.path = t.Format(f.pathFormat)
	f.day = t.YearDay()

	// we can't assume that the dir for the file already exists
	dir := filepath.Dir(f.path)
	err := os.MkdirAll(dir, 0755)
	if err != nil {
		return err
	}

	flag := os.O_CREATE | os.O_APPEND | os.O_WRONLY
	f.file, err = os.OpenFile(f.path, flag, 0644)
	return err
}

// rotate on new day
func (f *DailyRotateFile) reopenIfNeeded() error {
	t := time.Now()
	if t.YearDay() == f.day {
		return nil
	}
	err := f.close()
	if err != nil {
		return err
	}
	return f.open()
}

// NewDailyRotateFile opens a new log file (creates if doesn't exist, will append if exists)
func NewDailyRotateFile(pathFormat string) (*DailyRotateFile, error) {
	res := &DailyRotateFile{
		pathFormat: pathFormat,
	}
	if err := res.open(); err != nil {
		return nil, err
	}
	return res, nil
}

// Close closes the file
func (f *DailyRotateFile) Close() error {
	var err error
	if f != nil {
		f.Lock()
		err = f.close()
		f.Unlock()
	}
	return err
}

// Write writes data to a file
func (f *DailyRotateFile) Write(d []byte) (int, error) {
	if f == nil {
		return 0, errors.New("File not opened")
	}
	f.Lock()
	defer f.Unlock()
	err := f.reopenIfNeeded()
	if err != nil {
		return 0, err
	}
	return f.file.Write(d)
}

// Flush flushes the file
func (f *DailyRotateFile) Flush() error {
	f.Lock()
	defer f.Unlock()
	return f.file.Sync()
}

// WriteString writes a string to a file
func (f *DailyRotateFile) WriteString(s string) (int, error) {
	return f.Write([]byte(s))
}

// Printf formats and writes to the file
func (f *DailyRotateFile) Printf(format string, arg ...interface{}) {
	f.WriteString(fmt.Sprintf(format, arg...))
}

// IncVerbosity increases verbosity level.
// the idea of verbose logging is to provide a way to turn detailed logging
// on a per-request basis. This is an approximate solution: since there is
// no per-gorutine context, we use a shared variable that is increased at request
// beginning and decreased at end. We might get additional logging from other
// gorutines. It's much simpler than an alternative, like passing a logger
// to every function that needs to log
func IncVerbosity() {
	atomic.AddInt32(&verbosityLevel, 1)
}

// DecVerbosity decreases verbosity level
func DecVerbosity() {
	atomic.AddInt32(&verbosityLevel, -1)
}

// IsVerbose returns true if we're doing verbose logging
func IsVerbose() bool {
	return atomic.LoadInt32(&verbosityLevel) > 0
}

/*
StartVerboseForURL will start verbose logging if the url has vl= arg in it.
The intended usage is:

if StartVerboseForURL(r.URL) {
  defer StopVerboseForURL()
}
*/
func StartVerboseForURL(u *url.URL) bool {
	// "vl" stands for "verbose logging" and any value other than empty string
	// truns it on
	if u.Query().Get("vl") != "" {
		IncVerbosity()
		return true
	}
	return false
}

// StopVerboseForURL is for name parity with StartVerboseForURL()
func StopVerboseForURL() {
	DecVerbosity()
}

func open(pathFormat string, fileOut **DailyRotateFile) error {
	lf, err := NewDailyRotateFile(pathFormat)
	if err != nil {
		return err
	}
	*fileOut = lf
	return nil
}

// Open opens a standard log file
func Open(pathFormat string) error {
	return open(pathFormat, &logInfo)
}

// OpenError opens a log file for errors
func OpenError(pathFormat string) error {
	return open(pathFormat, &logError)
}

// Close closes all log files
func Close() {
	logInfo.Close()
	logInfo = nil
	logError.Close()
	logError = nil
}

func functionFromPc(pc uintptr) string {
	fn := runtime.FuncForPC(pc)
	if fn == nil {
		return ""
	}
	name := []byte(fn.Name())
	// The name includes the path name to the package, which is unnecessary
	// since the file name is already included.  Plus, it has center dots.
	// That is, we see
	//      runtime/debug.*T·ptrmethod
	// and want
	//      *T.ptrmethod
	if period := bytes.Index(name, dot); period >= 0 {
		name = name[period+1:]
	}
	name = bytes.Replace(name, centerDot, dot, -1)
	return string(name)
}

func p(info *DailyRotateFile, err *DailyRotateFile, s string) {
	if LogToStdout {
		fmt.Print(s)
	}
	if err != nil {
		err.WriteString(s)
		return
	}
	info.WriteString(s)
}

// Fatalf is like log.Fatalf() but also pre-pends name of the caller,
// so that we don't have to do that manually in every log statement
func Fatalf(format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = functionFromPc(pc) + ": " + s
	}
	p(logInfo, logError, s)
	fmt.Print(s)
	log.Fatal(s)
}

// Errorf logs an error to error log (if not available, to info log)
// Prepends name of the function that called it
func Errorf(format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = functionFromPc(pc) + ": " + s
	}
	p(logInfo, logError, s)
}

// Error logs error to error log (if not available, to info log)
func Error(err error) {
	s := err.Error() + "\n"
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = functionFromPc(pc) + ": " + s
	}
	p(logInfo, logError, s)
}

// Infof logs non-error things
func Infof(format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = functionFromPc(pc) + ": " + s
	}
	p(logInfo, nil, s)
}

// Verbosef logs more detailed information if verbose logging
// is turned on
func Verbosef(format string, arg ...interface{}) {
	if !IsVerbose() {
		return
	}
	s := fmt.Sprintf(format, arg...)
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = functionFromPc(pc) + ": " + s
	}
	p(logInfo, nil, s)
}
