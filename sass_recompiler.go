package main

import (
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/go-fsnotify/fsnotify"
	"github.com/kjk/u"
	"github.com/mgutz/ansi"
)

var (
	fileWatcher *fsnotify.Watcher
)

func ensureHasSassc() {
	cmd := exec.Command("sassc", "-h")
	_, err := cmd.CombinedOutput()
	if err != nil {
		LogInfof("sassc compiler doesn't seem to be installed.\nOn mac: brew install sassc")
		os.Exit(1)
	}
}

func isSassFile(name string) bool {
	return strings.HasSuffix(name, ".sass") || strings.HasSuffix(name, ".scss")
}

func isMainSassFile(name string) bool {
	return strings.HasSuffix(name, "_main.sass") || strings.HasSuffix(name, "_main.scss")
}

func sassNameToCSSName(s string) string {
	if isMainSassFile(s) {
		return s[:len(s)-len("_main.sass")] + ".css"
	}
	return s
}

func sassCompile(sassFile string) {
	dstFile := filepath.Join("..", "s", "css", sassNameToCSSName(sassFile))
	LogInfof("sass compiling %s => %s\n", sassFile, dstFile)
	cmd := exec.Command("sassc", sassFile, dstFile)
	cmd.Dir = "css"
	out, err := cmd.CombinedOutput()
	if err != nil {
		s := strings.TrimSpace(string(out))
		errStrColored := ansi.Color(s, "red+b")
		LogInfof("failed to sass compile: %s\n", errStrColored)
	}
}

func sassCompileAll() {
	files, err := ioutil.ReadDir("css")
	if err != nil {
		LogErrorf("os.ReadDir('css') failed with %s\n", err)
		return
	}
	for _, fi := range files {
		if isMainSassFile(fi.Name()) {
			sassCompile(fi.Name())
		}
	}
}

func triggersSassRecompile(e fsnotify.Event) bool {
	if !isSassFile(e.Name) {
		return false
	}
	if e.Op&fsnotify.Create == fsnotify.Create {
		return true
	}
	if e.Op&fsnotify.Remove == fsnotify.Remove {
		return true
	}
	if e.Op&fsnotify.Rename == fsnotify.Rename {
		return true
	}
	if e.Op&fsnotify.Write == fsnotify.Write {
		return true
	}
	return false
}

// watches for changes in css directory, re-runs sassc compiler on css files
// if .sass or .sassc file changed
func recompileWorker() {
	fileWatcher.Add("css")

	for {
		select {
		case event := <-fileWatcher.Events:
			//LogInfof("fs event: %s\n", event)
			if triggersSassRecompile(event) {
				sassCompileAll()
			}
		case err := <-fileWatcher.Errors:
			LogErrorf("recompileWorker: got fsnotify error '%s'\n", err)
			return
		}
	}
}

func startRecompileMust() {
	sassCompileAll()
	var err error
	fileWatcher, err = fsnotify.NewWatcher()
	u.PanicIfErr(err)
	go recompileWorker()
}
