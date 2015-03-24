package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/garyburd/go-oauth/oauth"
	"github.com/kjk/u"
	"github.com/speps/go-hashids"
)

var (
	httpAddr = ":5111"

	flgIsLocal              bool // local means using local mysql database, production means google's cloud
	flgDelDatabase          bool
	flgRecreateDatabase     bool
	flgImportJSONUserHandle string
	flgImportJSONFile       string
	flgListUsers            bool

	localStore  *LocalStore
	oauthClient = oauth.Client{
		TemporaryCredentialRequestURI: "https://api.twitter.com/oauth/request_token",
		ResourceOwnerAuthorizationURI: "https://api.twitter.com/oauth/authenticate",
		TokenRequestURI:               "https://api.twitter.com/oauth/access_token",
	}
	hashIDMu sync.Mutex
	hashID   *hashids.HashID
)

func initHashID() {
	hd := hashids.NewData()
	hd.Salt = "bo-&)()(*&tamalola"
	hd.MinLength = 4
	hashID = hashids.NewWithData(hd)
}

func hashInt(n int) string {
	nums := []int{n}
	hashIDMu.Lock()
	res, err := hashID.Encode(nums)
	hashIDMu.Unlock()
	u.PanicIfErr(err)
	return res
}

func dehashInt(s string) int {
	hashIDMu.Lock()
	nums := hashID.Decode(s)
	hashIDMu.Unlock()
	u.PanicIf(len(nums) != 1, "len(nums) is not 1")
	return nums[0]
}

func initAppMust() {
	initCookieMust()
	initHashID()
}

func verifyDirs() {
	if !u.PathExists(getLogDir()) {
		log.Fatalf("directory '%s' doesn't exist\n", getLogDir())
	}
	if !u.PathExists(getDataDir()) {
		log.Fatalf("directory '%s' doesn't exist\n", getDataDir())
	}
}

func getDataDir() string {
	if flgIsLocal {
		return u.ExpandTildeInPath("~/data/quicknotes")
	}
	//  on the server it's in /home/quicknotes/www/data
	return u.ExpandTildeInPath("~/www/data")
}

func getLogDir() string {
	return filepath.Join(getDataDir(), "log")
}

func getLocalStoreDir() string {
	return filepath.Join(getDataDir(), "localstore")
}

func parseFlags() {
	flag.BoolVar(&flgIsLocal, "local", false, "running locally?")
	flag.BoolVar(&flgDelDatabase, "deldb", false, "completely delete the database? dangerous!")
	flag.BoolVar(&flgRecreateDatabase, "recreatedb", false, "recreate database")
	flag.StringVar(&flgImportJSONFile, "import-json", "", "name of .json or .json.bz2 files from which to import notes; also must spcecify -import-user")
	flag.StringVar(&flgImportJSONUserHandle, "import-user", "", "handle of the user (users.handle) for which to import notes")
	flag.BoolVar(&flgListUsers, "list-users", false, "list handles of users in the db")
	flag.Parse()
}

func startWebpackWatch() {
	cmd := exec.Command("./scripts/webpack-dev.sh")
	cmdStr := strings.Join(cmd.Args, " ")
	fmt.Printf("starting '%s'\n", cmdStr)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Start()
	if err != nil {
		log.Fatalf("cmd.Start('%s') failed with '%s'\n", cmdStr, err)
	}
}

func startJsxWatch() {
	cmd := exec.Command("jsx", "--no-cache-dir", "--watch", "-x", "jsx", "jsxsrc/", "s/js/")
	cmdStr := strings.Join(cmd.Args, " ")
	fmt.Printf("starting '%s'\n", cmdStr)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Start()
	if err != nil {
		log.Fatalf("cmd.Start('%s') failed with '%s'\n", cmdStr, err)
	}
}

func listDbUsers() {
	users, err := dbGetAllUsers()
	if err != nil {
		log.Fatalf("dbGetAllUsers() failed with '%s'", err)
	}
	fmt.Printf("Number of users: %d\n", len(users))
	for _, u := range users {
		fmt.Printf("handle: '%s'\n", u.Handle)
	}
}

func main() {
	var err error

	runtime.GOMAXPROCS(runtime.NumCPU())

	parseFlags()
	logToStdout = true
	verifyDirs()
	OpenLogFiles()
	IncLogVerbosity()
	LogInfof("local: %v, sql connection: %s, data dir: %s\n", flgIsLocal, getSqlConnectionRoot(), getDataDir())

	if flgListUsers {
		listDbUsers()
		return
	}

	localStore, err = NewLocalStore(getLocalStoreDir())
	if err != nil {
		LogFatalf("NewLocalStore() failed with %s\n", err)
	}

	if flgImportJSONFile != "" {
		importNotesFromJSON(flgImportJSONFile, flgImportJSONUserHandle)
		return
	}

	if flgDelDatabase {
		deleteDatabaseMust()
		return
	}

	if flgRecreateDatabase {
		recreateDatabaseMust()
		return
	}

	if false {
		testListObjects()
		return
	}

	getDbMust()
	if flgIsLocal {
		startWebpackWatch()
	}

	initAppMust()
	startWebServer()
	// TODO: this isn't actually called
	localStore.Close()
}
