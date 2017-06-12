package main

import (
	"archive/zip"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/acme/autocert"

	"github.com/kjk/quicknotes/pkg/log"
	"github.com/kjk/u"
)

var (
	bundleJSPath       = "s/dist/bundle.js"
	bundleJSPathIsSha1 = false
	mainCSSPath        = "s/dist/main.css"
	mainCSSPathIsSha1  = false
)

// HandlerWithCtxFunc is like http.HandlerFunc but with additional ReqContext argument
type HandlerWithCtxFunc func(*ReqContext, http.ResponseWriter, *http.Request)

// ReqOpts is a set of flags passed to withCtx
type ReqOpts uint

const (
	// OnlyGet tells to reject non-GET requests
	OnlyGet ReqOpts = 1 << iota
	// OnlyPost tells to reject non-POST requests
	OnlyPost
	// OnlyLoggedIn means the user must be logged in
	OnlyLoggedIn
	// OnlyAdmin means the user must be logged in and an admin
	OnlyAdmin
	// IsJSON denotes a handler that is serving JSON requests and should send
	// errors as { "error": "error message" }
	IsJSON
)

// UserSummary describes logged-in user
type UserSummary struct {
	id     int
	HashID string
	Handle string
	login  string
}

// Timing describes how long did it take to execute a piece of code
type Timing struct {
	What      string
	TimeStart time.Time
	Duration  time.Duration
}

// Start marks a start of an event
func (t *Timing) Start(what string) {
	t.What = what
	t.TimeStart = time.Now()
}

// Finished marks an end of an event
func (t *Timing) Finished() time.Duration {
	t.Duration = time.Since(t.TimeStart)
	return t.Duration
}

// ReqContext contains data that is useful to access in every http handler
type ReqContext struct {
	User    *UserSummary // nil if not logged in
	Timings []*Timing
}

// NewTimingf starts to time a new event
func (ctx *ReqContext) NewTimingf(format string, args ...interface{}) *Timing {
	t := &Timing{}
	t.Start(fmt.Sprintf(format, args...))
	ctx.Timings = append(ctx.Timings, t)
	return t
}

func withCtx(f HandlerWithCtxFunc, opts ReqOpts) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uri := r.URL.Path
		ctx := &ReqContext{}
		timing := ctx.NewTimingf("uri: %s", uri)
		rrw := NewRecordingResponseWriter(w)
		defer func() {
			dur := timing.Finished()
			userID := 0
			if ctx.User != nil {
				userID = ctx.User.id
			}
			logHTTP(r, rrw.Code, rrw.BytesWritten, userID, dur)
		}()
		ctx.User = getUserSummaryFromCookie(rrw, r)

		isJSON := opts&IsJSON != 0
		onlyLoggedIn := opts&OnlyLoggedIn != 0
		onlyGet := opts&OnlyGet != 0
		onlyPost := opts&OnlyPost != 0

		if onlyLoggedIn && ctx.User == nil {
			serveError(rrw, r, isJSON, "not logged in")
			return
		}

		method := strings.ToUpper(r.Method)
		if onlyGet && method != "GET" {
			serveError(rrw, r, isJSON, fmt.Sprintf("%s %s is not GET", method, uri))
			return
		}

		if onlyPost && method != "POST" {
			serveError(rrw, r, isJSON, fmt.Sprintf("%s %s is not POST", method, uri))
			return
		}

		// if user is logged in, redirect / to their notes
		if ctx.User != nil && r.URL.String() == "/" {
			url := "/u/" + ctx.User.HashID + "/" + ctx.User.Handle
			http.Redirect(w, r, url, http.StatusFound)
			return
		}

		f(ctx, rrw, r)
		timing.Finished()
		if timing.Duration > time.Millisecond*500 {
			log.Infof("slow handler: '%s' took %s\n", r.RequestURI, timing.Duration)
		}
	}
}

var (
	// loaded only once at startup. maps a file path of the resource
	// to its data
	resourcesFromZip map[string][]byte
)

func hasZipResources() bool {
	return len(resourcesFromZip) > 0
}

func normalizePath(s string) string {
	return strings.Replace(s, "\\", "/", -1)
}

func loadResourcesFromZipReader(zr *zip.Reader) error {
	resourcesFromZip = make(map[string][]byte)
	for _, f := range zr.File {
		name := normalizePath(f.Name)
		rc, err := f.Open()
		if err != nil {
			return err
		}
		d, err := ioutil.ReadAll(rc)
		rc.Close()
		if err != nil {
			return err
		}
		//log.Verbosef("Loaded '%s' of size %d bytes\n", name, len(d))
		resourcesFromZip[name] = d
	}

	bundleJSPath, bundleJSPathIsSha1 = sha1ifyZipResource(bundleJSPath)
	mainCSSPath, mainCSSPathIsSha1 = sha1ifyZipResource(mainCSSPath)

	return nil
}

func loadResourceFile(name string) ([]byte, error) {
	if d, ok := resourcesFromZip[name]; ok {
		return d, nil
	}
	return ioutil.ReadFile(name)
}

// call this only once at startup
func loadResourcesFromZip(path string) error {
	zrc, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer zrc.Close()
	return loadResourcesFromZipReader(&zrc.Reader)
}

func sha1ifyPath(path string, sha1Hex string) string {
	ext := filepath.Ext(path)
	base := path[:len(path)-len(ext)]
	return base + "-" + sha1Hex + ext
}

func sha1ifyZipResource(path string) (string, bool) {
	d, ok := resourcesFromZip[path]
	if !ok {
		log.Verbosef("no resource '%s'\n", path)
		return path, false
	}
	sha1 := u.Sha1HexOfBytes(d)
	newPath := sha1ifyPath(path, sha1)
	log.Verbosef("%s => %s\n", path, newPath)
	resourcesFromZip[newPath] = d
	if d, ok = resourcesFromZip[path+".gz"]; ok {
		log.Verbosef("%s => %s\n", path+".gz", newPath+".gz")
		resourcesFromZip[newPath+".gz"] = d
	}
	if d, ok = resourcesFromZip[path+".br"]; ok {
		log.Verbosef("%s => %s\n", path+".br", newPath+".br")
		resourcesFromZip[newPath+".br"] = d
	}
	return newPath, true
}

func shouldCacheResource(path string) bool {
	if bundleJSPathIsSha1 && path == bundleJSPath {
		return true
	}
	if mainCSSPathIsSha1 && path == mainCSSPath {
		return true
	}
	return false
}

func userSummaryFromDbUser(dbUser *DbUser) *UserSummary {
	if dbUser == nil {
		return nil
	}
	return &UserSummary{
		id:     dbUser.ID,
		HashID: hashInt(dbUser.ID),
		Handle: dbUser.GetHandle(),
		login:  dbUser.Login,
	}
}

func getUserSummaryFromCookie(w http.ResponseWriter, r *http.Request) *UserSummary {
	dbUser := getDbUserFromCookie(w, r)
	return userSummaryFromDbUser(dbUser)
}

func serveResourceFromZip(w http.ResponseWriter, r *http.Request, path string) {
	path = normalizePath(path)

	data := resourcesFromZip[path]
	gzippedData := resourcesFromZip[path+".gz"]
	brotliData := resourcesFromZip[path+".br"]

	log.Verbosef("serving '%s' from zip, hasGzippedVersion: %v\n", path, len(gzippedData) > 0)

	if data == nil {
		log.Errorf("no data for file '%s'\n", path)
		servePlainText(w, r, 404, fmt.Sprintf("file '%s' not found", path))
		return
	}

	if len(data) == 0 {
		servePlainText(w, r, 404, "Asset is empty")
		return
	}

	shouldCache := shouldCacheResource(path)
	serveData(w, r, 200, MimeTypeByExtensionExt(path), data, gzippedData, brotliData, shouldCache)
}

func handleFavicon(w http.ResponseWriter, r *http.Request) {
	http.NotFound(w, r)
}

// /s/$rest
func handleStatic(w http.ResponseWriter, r *http.Request) {
	if hasZipResources() {
		path := r.URL.Path[1:] // remove initial "/" i.e. "/s/*" => "s/*"
		serveResourceFromZip(w, r, path)
		return
	}

	fileName := r.URL.Path[len("/s/"):]
	path := filepath.Join("s", fileName)

	if u.FileExists(path) {
		http.ServeFile(w, r, path)
		return
	}
	log.Verbosef("file %q doesn't exist, referer: %q\n", fileName, getReferer(r))
	http.NotFound(w, r)
}

func isAllowedURL(uri string) bool {
	switch uri {
	case "/", "/welcome":
		return true
	}
	if strings.HasPrefix(uri, "/dbg/") {
		return true
	}
	return false
}

/*
Big picture:
/ - main page, shows recent public notes, on-boarding for new users
/idx/allnotes - show latest public notes
/s/{path} - static files
/u/{idHashed} - main page for a given user. Shows read-write UI if
  it's a logged-in user. Shows only public if user's owner != logged in
  user
/n/${noteHashIDed} - show a single note
/api/* - api calls
*/

func handleIndex(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path

	if ctx.User != nil {
		log.Verbosef("url: '%s', user: %d (%s), handle: '%s'\n", uri, ctx.User.id, ctx.User.HashID, ctx.User.Handle)
	} else {
		log.Verbosef("url: '%s'\n", uri)
	}

	v := struct {
		// common for all pages
		LoggedUser   *UserSummary
		Title        string
		BundleJSPath string
		MainCSSPath  string
		IsLocal      bool

		// for / and /u/
		Notes     []*Note
		NotesUser *UserSummary

		// for /n/
		NoteUser *UserSummary
		Note     []interface{}
	}{
		LoggedUser:   ctx.User,
		Title:        "QuickNotes",
		BundleJSPath: "/" + bundleJSPath,
		MainCSSPath:  "/" + mainCSSPath,
		IsLocal:      !flgProduction,
	}

	if strings.HasPrefix(uri, "/u/") {
		// /u/${userId}/${whatever}
		userIDHash := r.URL.Path[len("/u/"):]
		userIDHash = strings.Split(userIDHash, "/")[0]
		userID, err := dehashInt(userIDHash)
		if err != nil {
			log.Errorf("invalid userID='%s'\n", userIDHash)
			http.NotFound(w, r)
			return
		}
		i, err := getCachedUserInfo(userID)
		if err != nil || i == nil {
			log.Errorf("no user '%d', url: '%s', err: %s\n", userID, r.URL, err)
			http.NotFound(w, r)
			return
		}
		notesUser := userSummaryFromDbUser(i.user)
		log.Verbosef("%d notes for user %d (%s)\n", len(i.notes), userID, userIDHash)
		v.NotesUser = notesUser
		v.Title = fmt.Sprintf("Notes by %s", notesUser.Handle)
	} else if strings.HasPrefix(uri, "/n/") {

		// /n/{note_id_hash}-rest
		noteHashIDStr := r.URL.Path[len("/n/"):]
		// remove optional part after -, which is constructed from note title
		if idx := strings.Index(noteHashIDStr, "-"); idx != -1 {
			noteHashIDStr = noteHashIDStr[:idx]
		}

		note, err := getNoteByIDHash(ctx, noteHashIDStr)
		if err != nil || note == nil {
			log.Error(err)
			http.NotFound(w, r)
			return
		}

		compactNote, err := noteToCompact(note, true)
		if err != nil {
			httpErrorf(w, "noteToCompact() failed with %s", err)
			return
		}
		dbNoteUser, err := dbGetUserByID(note.userID)
		if err != nil {
			httpErrorf(w, "dbGetUserByID(%d) failed with %s", note.userID, err)
			return
		}
		noteUser := userSummaryFromDbUser(dbNoteUser)

		v.Note = compactNote
		v.NoteUser = noteUser
		v.Title = note.Title
	} else {
		if !isAllowedURL(uri) {
			http.NotFound(w, r)
			return
		}
	}

	execTemplate(w, tmplIndex, v)
}

// must match Note.js
const (
	noteIDVerIdx     = 0
	noteTitleIdx     = 1
	noteSizeIdx      = 2
	noteFlagsIdx     = 3
	noteCreatedAtIdx = 4
	noteUpdatedAtIdx = 5
	noteFormatIdx    = 6
	noteTagsIdx      = 7
	noteSnippetIdx   = 8
	noteFieldsCount  = 9
	noteContentIdx   = 9
)

// must match Note.js
const (
	flagStarredBit   = 0
	flagDeletedBit   = 1
	flagPublicBit    = 2
	flagPartialBit   = 3
	flagTruncatedBit = 4
)

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// encode multiple bool flags as a single int
func encodeNoteFlags(n *Note) int {
	res := (1 << flagStarredBit) * boolToInt(n.IsStarred)
	res += (1 << flagDeletedBit) * boolToInt(n.IsDeleted)
	res += (1 << flagPublicBit) * boolToInt(n.IsPublic)
	res += (1 << flagPartialBit) * boolToInt(n.IsPartial)
	res += (1 << flagTruncatedBit) * boolToInt(n.IsTruncated)
	return res
}

func isBitSet(flags int, nBit uint) bool {
	return flags&(1<<nBit) != 0
}

// can return error only if withContent is true
func noteToCompact(n *Note, withContent bool) ([]interface{}, error) {
	nFields := noteFieldsCount
	if withContent {
		nFields++
	}
	res := make([]interface{}, nFields, nFields)
	res[noteIDVerIdx] = fmt.Sprintf("%s-%d", n.HashID, n.CurrVersionID)
	res[noteTitleIdx] = n.Title
	res[noteSizeIdx] = n.Size
	res[noteFlagsIdx] = encodeNoteFlags(n)
	res[noteCreatedAtIdx] = n.CreatedAt.Unix() * 1000
	res[noteUpdatedAtIdx] = n.UpdatedAt.Unix() * 1000
	res[noteFormatIdx] = n.Format
	res[noteTagsIdx] = n.Tags
	res[noteSnippetIdx] = n.Snippet
	if withContent {
		content, err := getCachedContent(n.ContentSha1)
		if err != nil {
			return nil, err
		}
		res[noteContentIdx] = string(content)
	}
	return res, nil
}

// GET /idx/allnotes
// args:
// - page
func handleIndexAllNotes(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	var err error
	log.Verbosef("url: '%s'\n", r.URL)
	pageNo := 1
	pageNoStr := strings.TrimSpace(r.FormValue("page"))
	if pageNoStr != "" {
		pageNo, err = strconv.Atoi(pageNoStr)
		if err != nil {
			log.Errorf("Invalid 'page' argument in '%s': '%s'\n", r.URL, pageNoStr)
			pageNo = 0
		}
	}
	log.Verbosef("pageNo: %d\n", pageNo)
	path := notesIndexPagePath(pageNo)
	serveMaybeGzippedFile(w, r, path)
}

func handleRawNote(w http.ResponseWriter, r *http.Request) {
	uri := r.RequestURI
	s := strings.TrimPrefix(uri, "/raw/n/")
	parts := strings.SplitN(s, "-", 2)
	noteID, err := dehashInt(parts[0])
	if err != nil {
		http.NotFound(w, r)
		return
	}
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	user := getUserSummaryFromCookie(w, r)
	if !userCanAccessNote(user, note) {
		http.NotFound(w, r)
		return
	}

	var lines []string

	s = "Id: " + note.HashID
	lines = append(lines, s)

	if note.Title != "" {
		s = "Title: " + note.Title
		lines = append(lines, s)
	}

	// convert to what blog import understands
	format := note.Format
	if format != "" {
		switch format {
		case "md":
			format = "Markdown"
		}
		s = "Format: " + note.Format
		lines = append(lines, s)
	}

	if len(note.Tags) > 0 {
		s = "Tags: " + strings.Join(note.Tags, ", ")
		lines = append(lines, s)
	}

	createdAt := note.CreatedAt.Format(time.RFC3339)
	s = "Date: " + createdAt
	lines = append(lines, s)
	lines = append(lines, "--------------")
	lines = append(lines, note.Content())
	s = strings.Join(lines, "\n")
	servePlainText(w, r, 200, "%s", s)
}

// https://blog.gopheracademy.com/advent-2016/exposing-go-on-the-internet/
func makeHTTPServer() *http.Server {
	mux := &http.ServeMux{}

	mux.HandleFunc("/", withCtx(handleIndex, OnlyGet))
	mux.HandleFunc("/favicon.ico", handleFavicon)
	mux.HandleFunc("/s/", handleStatic)
	mux.HandleFunc("/raw/n/", handleRawNote)
	mux.HandleFunc("/idx/allnotes", withCtx(handleIndexAllNotes, OnlyGet))
	mux.HandleFunc("/logintwitter", handleLoginTwitter)
	mux.HandleFunc("/logintwittercb", handleOauthTwitterCallback)
	mux.HandleFunc("/logingithub", handleLoginGitHub)
	mux.HandleFunc("/logingithubcb", handleOauthGitHubCallback)
	mux.HandleFunc("/logingoogle", handleLoginGoogle)
	mux.HandleFunc("/logingooglecb", handleOauthGoogleCallback)

	mux.HandleFunc("/logout", handleLogout)
	mux.HandleFunc("/api/ws", handleWs)
	mux.HandleFunc("/api/import_simplenote_start", withCtx(handleAPIImportSimpleNoteStart, OnlyLoggedIn|IsJSON))
	mux.HandleFunc("/api/import_simplenote_status", withCtx(handleAPIImportSimpleNotesStatus, OnlyLoggedIn|IsJSON))

	srv := &http.Server{
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  120 * time.Second, // introduced in Go 1.8
		Handler:      mux,
	}
	// TODO: track connections and their state
	return srv
}

func startWebServer() {
	if flgProduction {
		srv := makeHTTPServer()
		hostPolicy := func(ctx context.Context, host string) error {
			if strings.HasSuffix(host, "quicknotes.io") {
				return nil
			}
			return errors.New("acme/autocert: only *.quicknotes.io hosts are allowed")
		}

		m := autocert.Manager{
			Prompt:     autocert.AcceptTOS,
			HostPolicy: hostPolicy,
		}
		srv.Addr = ":443"
		srv.TLSConfig = &tls.Config{GetCertificate: m.GetCertificate}
		log.Infof("Started runing HTTPS on %s\n", srv.Addr)
		go func() {
			srv.ListenAndServeTLS("", "")
		}()
	}

	srv := makeHTTPServer()
	srv.Addr = flgHTTPAddr
	log.Infof("Started runing on %s\n", flgHTTPAddr)
	if err := srv.ListenAndServe(); err != nil {
		log.Errorf("srv.ListendAndServer() failed with %s\n", err)
	}
}
