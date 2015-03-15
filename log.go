package main

import (
	"bytes"
	"fmt"
	"log"
	"net/url"
	"path/filepath"
	"runtime"
	"sync/atomic"
)

var (
	logInfo  *LogRotate
	logError *LogRotate

	dot               = []byte(".")
	centerDot         = []byte("·")
	logVerbosityLevel int32
)

const (
	rotateThreshold = 1024 * 1024 * 1024 // 1 GB
)

// the idea of verbose logging is to provide a way to turn detailed logging
// on a per-request basis. This is an approximate solution: since there is
// no per-gorutine context, we use a shared variable that is increased at request
// beginning and decreased at end. We might get additional logging from other
// gorutines. It's much simpler than an alternative, like passing a logger
// to every function that needs to log
func IncLogVerbosity() {
	atomic.AddInt32(&logVerbosityLevel, 1)
}

func DecLogVerbosity() {
	atomic.AddInt32(&logVerbosityLevel, -1)
}

func IsVerboseLogging() bool {
	return atomic.LoadInt32(&logVerbosityLevel) > 0
}

// the intended usage is:
// if StartVerboseLog(r.URL) {
//      defer DecLogVerbosity()
// }
func StartVerboseLog(u *url.URL) bool {
	// "vl" stands for "verbose logging" and any value other than empty string
	// truns it on
	if u.Query().Get("vl") != "" {
		IncLogVerbosity()
		return true
	}
	return false
}

// just for name parity with StartVerboseLog()
func StopVerboseLog() {
	DecLogVerbosity()
}

func OpenLogMust(fileName string, logPtr **LogRotate) {
	path := filepath.Join(getLogDir(), fileName)
	fmt.Printf("log file: %s\n", path)
	logTmp, err := NewLogRotate(path, rotateThreshold)
	if logTmp == nil {
		log.Fatalf("OpenLogMust: NewLogRotate(%q) failed with %q\n", path, err)
	}
	*logPtr = logTmp
}

func OpenLogFiles() {
	OpenLogMust("info.log", &logInfo)
	OpenLogMust("err.log", &logError)
}

func CloseLogFiles() {
	logInfo.Close()
	logInfo = nil
	logError.Close()
	logError = nil
}

func FunctionFromPc(pc uintptr) string {
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

// like log.Fatalf() but also pre-pends name of the caller, so that we don't
// have to do that manually in every log statement
func LogFatalf(format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = FunctionFromPc(pc) + ": " + s
	}
	fmt.Print(s)
	logError.Print(s)

	log.Fatal(s)
}

// For logging things that are unexpected but not fatal
// Automatically pre-pends name of the function calling the log function
func LogErrorf(format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = FunctionFromPc(pc) + ": " + s
	}

	logError.Print(s)
}

func LogError(s string) {
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = FunctionFromPc(pc) + ": " + s
	}
	logError.Print(s)
}

// For logging of misc non-error things
func LogInfof(format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = FunctionFromPc(pc) + ": " + s
	}
	logInfo.Print(s)
}

// verbose logging is meant for detailed information that is only enabled on
// a per request basis
func LogVerbosef(format string, arg ...interface{}) {
	if !IsVerboseLogging() {
		return
	}
	s := fmt.Sprintf(format, arg...)
	if pc, _, _, ok := runtime.Caller(1); ok {
		s = FunctionFromPc(pc) + ": " + s
	}
	logInfo.Print(s)
}
