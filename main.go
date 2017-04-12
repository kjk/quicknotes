package main

import (
	"encoding/csv"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/garyburd/go-oauth/oauth"
	"github.com/kjk/quicknotes/pkg/log"
)

const (
	defaultMaxResults = 64
)

var (
	flgHTTPAddr            string
	flgProduction          bool
	flgUseResourcesZip     bool
	flgVerbose             bool
	flgProdDb              bool // if true, use gce db when running localy
	flgDbHost              string
	flgDbPort              string
	flgImportJSONUserLogin string
	flgImportJSONFile      string
	flgSearchTerm          string
	flgSearchLocalTerm     string
	flgShowNote            string
	flgListUsers           bool
	flgImportStackOverflow bool

	localStore      *LocalStore
	httpLogs        *log.DailyRotateFile
	httpLogsCsv     *csv.Writer
	httpLogCsvMutex sync.Mutex

	oauthClient = oauth.Client{
		TemporaryCredentialRequestURI: "https://api.twitter.com/oauth/request_token",
		ResourceOwnerAuthorizationURI: "https://api.twitter.com/oauth/authenticate",
		TokenRequestURI:               "https://api.twitter.com/oauth/access_token",
	}
)

func verifyDirs() {
	if !PathExists(getLogDir()) {
		log.Fatalf("directory '%s' doesn't exist\n", getLogDir())
	}
	if !PathExists(getDataDir()) {
		log.Fatalf("directory '%s' doesn't exist\n", getDataDir())
	}
	err := os.MkdirAll(getCacheDir(), 0755)
	if err != nil {
		log.Fatalf("couldn't create directory '%s'\n", getCacheDir())
	}
}

var (
	dataDir string
)

func getDataDir() string {
	if dataDir != "" {
		return dataDir
	}

	// /data/quicknotes : on the server or when running locally on mac
	// ~/data/quicknotes : locally on mac
	// TODO: ~/www/data is legacy
	dirs := []string{"/data/quicknotes", "~/data/quicknotes", "~/www/data"}
	for _, dir := range dirs {
		dir = ExpandTildeInPath(dir)
		if PathExists(dir) {
			dataDir = dir
			log.Verbosef("dataDir: '%s'\n", dataDir)
			return dataDir
		}
	}
	fatalIf(true, "data dir doesn't exist. Tried: %v", dirs)
	return ""
}

func getLogDir() string {
	return filepath.Join(getDataDir(), "log")
}

func getCacheDir() string {
	return filepath.Join(getDataDir(), "cache")
}

func getLocalStoreDir() string {
	return filepath.Join(getDataDir(), "localstore")
}

func pathForFileInCache(path string) string {
	return filepath.Join(getCacheDir(), path)
}

func parseFlags() {
	flag.BoolVar(&flgProdDb, "proddb", false, "use production database when running locally")
	flag.BoolVar(&flgImportStackOverflow, "import-stack-overflow", false, "import stack overflow data")
	flag.StringVar(&flgImportJSONFile, "import-json", "", "name of .json or .json.bz2 files from which to import notes; also must spcecify -import-user")
	flag.StringVar(&flgImportJSONUserLogin, "import-user", "", "handle of the user (users.login) for which to import notes e.g. twitter:kjk")
	flag.BoolVar(&flgListUsers, "list-users", false, "list handles of users in the db")
	flag.StringVar(&flgSearchTerm, "search", "", "search notes for a given term")
	flag.StringVar(&flgSearchLocalTerm, "search-local", "", "search local notes for a given term")
	flag.StringVar(&flgDbHost, "db-host", "127.0.0.1", "database host")
	flag.StringVar(&flgDbPort, "db-port", "3306", "database port")
	flag.BoolVar(&flgVerbose, "verbose", false, "enable verbose logging")
	flag.StringVar(&flgShowNote, "show-note", "", "show a note with a given hashed id")
	flag.BoolVar(&flgProduction, "production", false, "running in production")
	flag.BoolVar(&flgUseResourcesZip, "use-resources-zip", false, "use quicknotes_resources.zip for static resources")
	flag.StringVar(&flgHTTPAddr, "http-addr", "127.0.0.1:5111", "address on which to listen")

	flag.Parse()
	if !flgProduction {
		onlyLocalStorage = true
	}
}

func runGulpAndWaitExit() {
	path := filepath.Join("node_modules", ".bin", "gulp")
	cmd := exec.Command(path, "build_and_watch")
	cmdStr := strings.Join(cmd.Args, " ")
	fmt.Printf("starting '%s'\n", cmdStr)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Start()
	if err != nil {
		log.Fatalf("cmd.Start('%s') failed with '%s'\n", cmdStr, err)
	}
	cmd.Wait()
}

func runGulpAsync() {
	go func() {
		for {
			runGulpAndWaitExit()
			time.Sleep(time.Second * 5)
		}
	}()
}

func listDbUsers() {
	users, err := dbGetAllUsers()
	if err != nil {
		log.Fatalf("dbGetAllUsers() failed with '%s'", err)
	}
	fmt.Printf("Number of users: %d\n", len(users))
	for _, u := range users {
		fmt.Printf("login: '%s'\n", u.Login)
	}
}

func openLogFilesMust() {
	pathFormat := filepath.Join(getLogDir(), "2006-01-02.txt")
	err := log.Open(pathFormat)
	fatalIfErr(err, "openLogFileMust")

	pathFormat = filepath.Join(getLogDir(), "2006-01-02-http.txt")
	httpLogs, err = log.NewDailyRotateFile(pathFormat)
	fatalIfErr(err, "openLogFileMust")
	httpLogsCsv = csv.NewWriter(httpLogs)
}

func logHTTP(r *http.Request, code, nBytesWritten, userID int, dur time.Duration) {
	t := time.Now().Unix()
	uri := r.URL.String()
	ip := getIPAddress(r)
	referer := getReferer(r)
	rec := []string{
		strconv.FormatInt(t, 10), // 0
		uri,                               // 1
		ip,                                // 2
		referer,                           // 3
		strconv.Itoa(code),                // 4
		strconv.Itoa(nBytesWritten),       // 5
		strconv.Itoa(userID),              // 6
		strconv.FormatInt(int64(dur), 10), // 7
	}
	httpLogCsvMutex.Lock()
	httpLogsCsv.Write(rec)
	httpLogsCsv.Flush()
	httpLogCsvMutex.Unlock()
}

func dailyTasksLoop() {
	// things we do at application start
	if flgProduction {
		sendBootMail()
	}
	buildPublicNotesIndex()

	// tasks we run once a day at 1 am
	for {
		nowUTC := time.Now().UTC()
		y, m, d := nowUTC.Date()
		nowZero := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
		timeNext := nowZero.Add(time.Hour * 25)
		//log.Verbosef("time now :%s\n", nowUTC.Format("2006-01-02 15:04:05"))
		//log.Verbosef("time now2:%s\n", nowZero.Format("2006-01-02 15:04:05"))
		//log.Verbosef("time next:%s\n", timeNext.Format("2006-01-02 15:04:05"))
		toWait := timeNext.Sub(nowUTC)
		log.Infof("waiting %s to do daily tasks\n", toWait)
		time.Sleep(toWait)

		timeStr := time.Now().Format("2006-01-02 15:04:05")
		log.Infof("executing daily tasks at %s\n", timeStr)
		buildPublicNotesIndex()
		sendStatsMail()
	}
}

func debugShowNote(hashedNoteID string) {
	noteID, err := dehashInt(hashedNoteID)
	PanicIfErr(err)
	note, err := dbGetNoteByID(noteID)
	PanicIfErr(err)
	body := note.Content()
	snippet := note.Snippet
	fmt.Printf(`Note id: %d (%s), partial: %v, truncated: %v
title: '%s'
tags: %v
body:
%s
-----
snippet:
%s
-----

`, note.id, note.HashID, note.IsPartial, note.IsTruncated, note.Title, note.Tags, body, snippet)
}

func main() {
	var err error
	parseFlags()
	log.LogToStdout = true
	if flgVerbose {
		log.IncVerbosity()
	}

	initCookieMust()
	initHashID()

	verifyDirs()
	openLogFilesMust()

	if flgProduction {
		flgHTTPAddr = ":80"
	}

	log.Infof("production: %v, proddb: %v, sql connection: %s, data dir: %s, httpAddr: %s, verbose: %v\n", flgProduction, flgProdDb, getSQLConnectionRoot(), getDataDir(), flgHTTPAddr, flgVerbose)

	if flgSearchLocalTerm != "" {
		searchLocalNotes(flgSearchLocalTerm, defaultMaxResults)
		return
	}

	if flgImportStackOverflow {
		localStore, err = NewLocalStore(getLocalStoreDir())
		fatalIfErr(err, "NewLocalStore()")
		importStackOverflow()
		return
	}

	if flgProduction || flgUseResourcesZip {
		log.Verbosef("using resources from embedded .zip\n")
		err = loadResourcesFromZip("quicknotes_resources.zip")
		if err != nil {
			log.Fatalf("loadResourcesFromZip() failed with '%s'\n", err)
		}
		fatalIf(!hasZipResources(), "should have zip resources")
	}
	// don't reload if we're reading from .zip resources
	reloadTemplates = !hasZipResources()

	getDbMust()

	if flgListUsers {
		listDbUsers()
		return
	}

	localStore, err = NewLocalStore(getLocalStoreDir())
	if err != nil {
		log.Fatalf("NewLocalStore() failed with %s\n", err)
	}

	if flgShowNote != "" {
		debugShowNote(flgShowNote)
		return
	}

	if flgImportJSONFile != "" {
		importNotesFromJSON(flgImportJSONFile, flgImportJSONUserLogin)
		return
	}

	if false {
		testListObjects()
		return
	}

	if flgSearchTerm != "" {
		searchAllNotesTest(flgSearchTerm, defaultMaxResults)
		return
	}

	if !hasZipResources() {
		runGulpAsync()
	}

	initGoogleStorageMust()

	_, err = dbGetOrCreateUser("email:quicknotes@quicknotes.io", "QuickNotes")
	fatalIfErr(err, "dbGetOrCreateUser")

	go dailyTasksLoop()

	startWebServer()

	// TODO: this isn't actually called
	localStore.Close()
}
