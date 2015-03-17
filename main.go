package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/garyburd/go-oauth/oauth"
	"github.com/kjk/u"
)

var (
	httpAddr            = ":5111"
	flgIsLocal          bool // local means using local mysql database, production means google's cloud
	flgDelDatabase      bool
	flgRecreateDatabase bool
	flgImportSimplenote bool
	localStore          *LocalStore
	oauthClient         = oauth.Client{
		TemporaryCredentialRequestURI: "https://api.twitter.com/oauth/request_token",
		ResourceOwnerAuthorizationURI: "https://api.twitter.com/oauth/authenticate",
		TokenRequestURI:               "https://api.twitter.com/oauth/access_token",
	}
	testMainUser *User
)

func initAppMust() {
	initCookieMust()
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
	flag.BoolVar(&flgImportSimplenote, "import-simplenote", false, "import simplenote notes from notes.json.bz2")
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

func main() {
	var err error
	parseFlags()
	logToStdout = true
	verifyDirs()
	OpenLogFiles()
	IncLogVerbosity()
	LogInfof("local: %v, sql connection: %s, data dir: %s\n", flgIsLocal, getSqlConnectionRoot(), getDataDir())

	localStore, err = NewLocalStore(getLocalStoreDir())
	if err != nil {
		LogFatalf("NewLocalStore() failed with %s\n", err)
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

	if flgImportSimplenote {
		fmt.Printf("importing simple note\n")
		err := importSimplenote()
		if err != nil {
			fmt.Printf("finished importing simple note, err: %s\n", err)
		} else {
			fmt.Printf("finished importing simple note\n")
		}
		return
	}

	getDbMust()
	if flgIsLocal {
		startWebpackWatch()
	}

	initAppMust()
	if false {
		dbGetUserByHandle("unkown user")
		return
	}
	startWebServer()
	// TODO: this isn't actually called
	localStore.Close()
}
