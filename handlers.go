package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/kjk/log"
	"github.com/kjk/u"
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
		ctx.User = getUserSummaryFromCookie(w, r)

		isJSON := opts&IsJSON != 0
		onlyLoggedIn := opts&OnlyLoggedIn != 0
		onlyGet := opts&OnlyGet != 0
		onlyPost := opts&OnlyPost != 0

		if onlyLoggedIn && ctx.User == nil {
			serveError(w, r, isJSON, "not logged in")
			return
		}

		method := strings.ToUpper(r.Method)
		if onlyGet && method != "GET" {
			serveError(w, r, isJSON, fmt.Sprintf("%s %s is not GET", method, uri))
			return
		}

		if onlyPost && method != "POST" {
			serveError(w, r, isJSON, fmt.Sprintf("%s %s is not POST", method, uri))
			return
		}

		f(ctx, w, r)
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
	return len(resourcesZipData) > 0
}

func normalizePath(s string) string {
	return strings.Replace(s, "\\", "/", -1)
}

func loadResourcesFromZipReader(zr *zip.Reader) error {
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
		// for simplicity of the build, the file that we embedded in zip
		// is bundle.min.js but the html refers to it as bundle.js
		if name == "s/dist/bundle.min.js" {
			name = "s/dist/bundle.js"
		}
		//log.Verbosef("Loaded '%s' of size %d bytes\n", name, len(d))
		resourcesFromZip[name] = d
	}
	return nil
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

// call this only once at startup
func loadResourcesFromZip(path string) error {
	resourcesFromZip = make(map[string][]byte)
	zrc, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer zrc.Close()
	return loadResourcesFromZipReader(&zrc.Reader)
}

func loadResourcesFromEmbeddedZip() error {
	timeStart := time.Now()
	defer func() {
		log.Verbosef(" in %s\n", time.Since(timeStart))
	}()

	n := len(resourcesZipData)
	if n == 0 {
		return errors.New("len(resourcesZipData) == 0")
	}
	resourcesFromZip = make(map[string][]byte)
	r := bytes.NewReader(resourcesZipData)
	zrc, err := zip.NewReader(r, int64(n))
	if err != nil {
		return err
	}
	return loadResourcesFromZipReader(zrc)
}

func serveResourceFromZip(w http.ResponseWriter, r *http.Request, path string) {
	path = normalizePath(path)

	data := resourcesFromZip[path]
	gzippedData := resourcesFromZip[path+".gz"]

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

	serveData(w, r, 200, MimeTypeByExtensionExt(path), data, gzippedData)
}

/*
Big picture:
/ - main page, shows recent public notes, on-boarding for new users
/latest - show latest public notes
/s/{path} - static files
/u/{idHashed} - main page for a given user. Shows read-write UI if
  it's a logged-in user. Shows only public if user's owner != logged in
  user
/n/${noteIdHashed} - show a single note
/api/* - api calls
*/

func handleIndex(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	if uri != "/" {
		http.NotFound(w, r)
		return
	}

	if ctx.User != nil {
		log.Verbosef("url: '%s', user: %d (%s), handle: '%s'\n", uri, ctx.User.id, ctx.User.HashID, ctx.User.Handle)
	} else {
		log.Verbosef("url: '%s'\n", uri)
	}
	v := struct {
		LoggedUser *UserSummary
	}{
		LoggedUser: ctx.User,
	}
	execTemplate(w, tmplIndex, v)
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

	if u.PathExists(path) {
		http.ServeFile(w, r, path)
		return
	}
	log.Verbosef("file %q doesn't exist, referer: %q\n", fileName, getReferer(r))
	http.NotFound(w, r)
}

// /u/${userId}/${whatever}
func handleUser(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	userHashID := r.URL.Path[len("/u/"):]
	userHashID = strings.Split(userHashID, "/")[0]
	userID, err := dehashInt(userHashID)
	if err != nil {
		log.Errorf("invalid userID='%s'\n", userHashID)
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
	log.Verbosef("%d notes for user %d (%s)\n", len(i.notes), userID, userHashID)
	model := struct {
		LoggedUser *UserSummary
		NotesUser  *UserSummary
		Notes      []*Note
	}{
		LoggedUser: ctx.User,
		NotesUser:  notesUser,
		Notes:      i.notes,
	}
	execTemplate(w, tmplUser, model)
}

func userCanAccessNote(loggedUser *UserSummary, note *Note) bool {
	if note.IsPublic {
		return true
	}
	return loggedUser != nil && loggedUser.id == note.userID
}

func getNoteByID(ctx *ReqContext, noteID int) (*Note, error) {
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		return nil, err
	}
	// TODO: when we have sharing via secret link we'll have to check
	// permissions
	if !userCanAccessNote(ctx.User, note) {
		return nil, fmt.Errorf("no access to note '%d'", noteID)
	}
	return note, nil
}

func getNoteByIDHash(ctx *ReqContext, noteIDHashStr string) (*Note, error) {
	noteIDHashStr = strings.TrimSpace(noteIDHashStr)
	noteID, err := dehashInt(noteIDHashStr)
	if err != nil {
		return nil, err
	}
	// log.Verbosef("note id hash: '%s', id: %d\n", noteIDHashStr, noteID)
	return getNoteByID(ctx, noteID)
}

// /n/{note_id_hash}-rest
func handleNote(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	noteIDHashStr := r.URL.Path[len("/n/"):]
	// remove optional part after -, which is constructed from note title
	if idx := strings.Index(noteIDHashStr, "-"); idx != -1 {
		noteIDHashStr = noteIDHashStr[:idx]
	}

	note, err := getNoteByIDHash(ctx, noteIDHashStr)
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

	model := struct {
		LoggedUser *UserSummary
		NoteUser   *UserSummary
		Note       []interface{}
		NoteTitle  string
	}{
		LoggedUser: ctx.User,
		Note:       compactNote,
		NoteUser:   noteUser,
		NoteTitle:  note.Title,
	}
	execTemplate(w, tmplNote, model)
}

// must match noteinfo.js
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

// must match noteinfo.js
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

// /api/getnote?id=${noteHashID}
func handleAPIGetNote(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	noteIDHashStr := r.FormValue("id")
	note, err := getNoteByIDHash(ctx, noteIDHashStr)
	if err != nil || note == nil {
		log.Error(err)
		httpErrorWithJSONf(w, r, "/api/getnote.json: missing or invalid id attribute '%s'", noteIDHashStr)
		return
	}
	if !userCanAccessNote(ctx.User, note) {
		httpErrorWithJSONf(w, r, "/api/getnote.json access denied")
		return
	}

	v, err := noteToCompact(note, true)
	if err != nil {
		log.Errorf("noteToCompact() failed with %s\n", err)
		httpErrorWithJSONf(w, r, "/api/getnote.json: getCachedContent() failed with %s", err)
		return
	}
	httpOkWithJSON(w, r, v)
}

// /api/getnotes
// Arguments:
//  - user : userID hashed
//  - jsonp : jsonp wrapper, optional
// Returns notes that belong to a given user. We return private notes only
// if logged in user is the same as user.
func handleAPIGetNotes(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	userHashID := strings.TrimSpace(r.FormValue("user"))
	jsonp := strings.TrimSpace(r.FormValue("jsonp"))
	log.Verbosef("userHashID: '%s', jsonp: '%s'\n", userHashID, jsonp)
	userID, err := dehashInt(userHashID)
	if err != nil {
		log.Errorf("invalid userHashID='%s'\n", userHashID)
		httpServerError(w, r)
		return
	}
	i, err := getCachedUserInfo(userID)
	if err != nil || i == nil {
		log.Errorf("getCachedUserInfo('%d') failed with '%s'\n", userID, err)
		httpServerError(w, r)
		return
	}

	showPrivate := ctx.User != nil && userID == ctx.User.id
	var notes [][]interface{}
	for _, note := range i.notes {
		if note.IsPublic || showPrivate {
			compactNote, _ := noteToCompact(note, false)
			notes = append(notes, compactNote)
		}
	}

	loggedUserID := -1
	loggedUserHandle := ""
	if ctx.User != nil {
		loggedUserHandle = ctx.User.Handle
		loggedUserID = ctx.User.id
	}
	log.Verbosef("%d notes of user '%d' ('%s'), logged in user: %d ('%s'), showPrivate: %v\n", len(notes), userID, i.user.Login, loggedUserID, loggedUserHandle, showPrivate)
	v := struct {
		LoggedUser *UserSummary
		Notes      [][]interface{}
	}{
		LoggedUser: ctx.User,
		Notes:      notes,
	}
	httpOkWithJsonpCompact(w, r, v, jsonp)
}

// /api/getrecentnotes
// Arguments:
//  - limit : max notes, to retrieve, 25 if not given
//  - jsonp : jsonp wrapper, optional
// TODO: allow getting private notes, for admin uses
func handleAPIGetRecentNotes(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	jsonp := strings.TrimSpace(r.FormValue("jsonp"))
	limitStr := strings.TrimSpace(r.FormValue("limit"))
	log.Verbosef("jsonp: '%s', limit: '%s'\n", jsonp, limitStr)
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 25
	}
	if limit > 300 {
		limit = 300
	}
	recentNotes, err := getRecentPublicNotesCached(limit)
	if err != nil {
		log.Errorf("getRecentPublicNotesCached() failed with %s\n", err)
		httpServerError(w, r)
		return
	}
	var res [][]interface{}
	for _, note := range recentNotes {
		compactNote, _ := noteToCompact(&note, false)
		res = append(res, compactNote)
	}
	httpOkWithJsonpCompact(w, r, res, jsonp)
}

// NewNoteFromBrowser represents format of the note sent by the browser
type NewNoteFromBrowser struct {
	HashID   string
	Title    string
	Format   string
	Content  string
	Tags     []string
	IsPublic bool
}

func newNoteFromArgs(r *http.Request) *NewNote {
	var newNote NewNote
	var note NewNoteFromBrowser
	var noteJSON = r.FormValue("noteJSON")
	if noteJSON == "" {
		log.Errorf("missing noteJSON value\n")
		return nil
	}
	err := json.Unmarshal([]byte(noteJSON), &note)
	if err != nil {
		log.Errorf("json.Unmarshal('%s') failed with %s", noteJSON, err)
		return nil
	}
	//log.Verbosef("note: %s\n", noteJSON)
	if !isValidFormat(note.Format) {
		log.Errorf("invalid format %s\n", note.Format)
		return nil
	}
	newNote.hashID = note.HashID
	newNote.title = note.Title
	newNote.content = []byte(note.Content)
	newNote.format = note.Format
	newNote.tags = note.Tags
	newNote.isPublic = note.IsPublic

	if newNote.title == "" && newNote.format == formatText {
		newNote.title, newNote.content = noteToTitleContent(newNote.content)
	}
	return &newNote
}

/*
POST /api/createorupdatenote
   noteJSON : note serialized as json in array format
returns:
  {
    HashID: $hashID
  }
*/
func handleAPICreateOrUpdateNote(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	note := newNoteFromArgs(r)
	if note == nil {
		log.Errorf("newNoteFromArgs() returned nil\n")
		httpErrorWithJSONf(w, r, "newNoteFromArgs() returned nil")
		return
	}

	noteID, err := dbCreateOrUpdateNote(ctx.User.id, note)
	if err != nil {
		log.Errorf("dbCreateNewNote() failed with %s\n", err)
		httpErrorWithJSONf(w, r, "dbCreateNewNot() failed with '%s'", err)
		return
	}
	v := struct {
		HashID string
	}{
		HashID: hashInt(noteID),
	}
	httpOkWithJSON(w, r, v)
}

func getUserNoteFromArgs(ctx *ReqContext, w http.ResponseWriter, r *http.Request) (int, error) {
	noteIDHashStr := strings.TrimSpace(r.FormValue("noteIdHash"))
	noteID, err := dehashInt(noteIDHashStr)
	if err != nil {
		return -1, err
		//httpErrorWithJSONf(w, r, "ivalid note id '%s'", noteIDHashStr)
	}
	log.Verbosef("note id hash: '%s', id: %d\n", noteIDHashStr, noteID)
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		return -1, err
		//log.Error(err)
		//httpErrorWithJSONf(w, r, "note doesn't exist")
		//return 0, -1
	}
	if note.userID != ctx.User.id {
		err = fmt.Errorf("note '%s' doesn't belong to user %d ('%s')\n", noteIDHashStr, ctx.User.id, ctx.User.Handle)
		return -1, err
		//httpErrorWithJSONf(w, r, "note doesn't belong to this user")
		//return 0, -1
	}
	return noteID, nil
}

// POST /api/permanentdeletenote
// args:
// - noteIdHash
func handleAPIPermanentDeleteNote(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	noteID, err := getUserNoteFromArgs(ctx, w, r)
	if err != nil {
		log.Errorf("getUserNoteFromArgs() failed with '%s'\n", err)
		httpErrorWithJSONf(w, r, "%s", err)
		return
	}
	err = dbPermanentDeleteNote(ctx.User.id, noteID)
	if err != nil {
		httpErrorWithJSONf(w, r, "failed to permanently delete note with '%s'", err)
		return
	}
	log.Verbosef("permanently deleted note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "note has been permanently deleted",
	}
	httpOkWithJSON(w, r, v)
}

func serveNoteCompact(ctx *ReqContext, w http.ResponseWriter, r *http.Request, noteID int) {
	note, err := getNoteByID(ctx, noteID)
	if err != nil {
		httpErrorWithJSONf(w, r, "getNoteByID() failed with '%s'", err)
		return
	}
	v, err := noteToCompact(note, true)
	httpOkWithJSON(w, r, v)
}

// GET /api/deletenote
// args:
// - noteIdHash
func handleAPIDeleteNote(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	noteID, err := getUserNoteFromArgs(ctx, w, r)
	if err != nil {
		log.Errorf("getUserNoteFromArgs() failed with '%s'\n", err)
		httpErrorWithJSONf(w, r, "%s", err)
		return
	}
	err = dbDeleteNote(ctx.User.id, noteID)
	if err != nil {
		httpErrorWithJSONf(w, r, "failed to delete note with '%s'", err)
		return
	}
	log.Verbosef("deleted note %d\n", noteID)
	serveNoteCompact(ctx, w, r, noteID)
}

// POST /api/undeletenote
// args:
// - noteIdHash
func handleAPIUndeleteNote(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	noteID, err := getUserNoteFromArgs(ctx, w, r)
	if err != nil {
		log.Errorf("getUserNoteFromArgs() failed with '%s'\n", err)
		httpErrorWithJSONf(w, r, "%s", err)
		return
	}
	err = dbUndeleteNote(ctx.User.id, noteID)
	if err != nil {
		httpErrorWithJSONf(w, r, "failed to undelete note with '%s'", err)
		return
	}
	log.Verbosef("undeleted note %d\n", noteID)
	serveNoteCompact(ctx, w, r, noteID)
}

// GET /api/makenoteprivate
// args:
// - noteIdHash
func handleAPIMakeNotePrivate(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	noteID, err := getUserNoteFromArgs(ctx, w, r)
	if err != nil {
		log.Errorf("getUserNoteFromArgs() failed with '%s'\n", err)
		httpErrorWithJSONf(w, r, "%s", err)
		return
	}
	err = dbMakeNotePrivate(ctx.User.id, noteID)
	if err != nil {
		httpErrorWithJSONf(w, r, "failed to make note private with '%s'", err)
		return
	}
	log.Verbosef("made note %d private\n", noteID)
	serveNoteCompact(ctx, w, r, noteID)
}

// GET /api/makenotepublic
// args:
// - noteIdHash
func handleAPIMakeNotePublic(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	noteID, err := getUserNoteFromArgs(ctx, w, r)
	if err != nil {
		log.Errorf("getUserNoteFromArgs() failed with '%s'\n", err)
		httpErrorWithJSONf(w, r, "%s", err)
		return
	}
	err = dbMakeNotePublic(ctx.User.id, noteID)
	if err != nil {
		httpErrorWithJSONf(w, r, "failed to make note public with '%s'", err)
		return
	}
	log.Verbosef("made note %d public\n", noteID)
	serveNoteCompact(ctx, w, r, noteID)
}

// GET /api/starnote
// args:
// - noteIdHash
func handleAPIStarNote(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	noteID, err := getUserNoteFromArgs(ctx, w, r)
	if err != nil {
		log.Errorf("getUserNoteFromArgs() failed with '%s'\n", err)
		httpErrorWithJSONf(w, r, "%s", err)
		return
	}
	err = dbStarNote(ctx.User.id, noteID)
	if err != nil {
		httpErrorWithJSONf(w, r, "failed to star note with '%s'", err)
		return
	}
	log.Verbosef("starred note %d\n", noteID)
	serveNoteCompact(ctx, w, r, noteID)
}

// GET /api/unstarnote
// args:
// - noteIdHash
func handleAPIUnstarNote(ctx *ReqContext, w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	noteID, err := getUserNoteFromArgs(ctx, w, r)
	if err != nil {
		log.Errorf("getUserNoteFromArgs() failed with '%s'\n", err)
		httpErrorWithJSONf(w, r, "%s", err)
		return
	}
	err = dbUnstarNote(ctx.User.id, noteID)
	if err != nil {
		httpErrorWithJSONf(w, r, "failed to unstar note with '%s'", err)
		return
	}
	log.Verbosef("unstarred note %d\n", noteID)
	serveNoteCompact(ctx, w, r, noteID)
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

func registerHTTPHandlers() {
	http.HandleFunc("/", withCtx(handleIndex, OnlyGet))
	http.HandleFunc("/favicon.ico", handleFavicon)
	http.HandleFunc("/s/", handleStatic)
	http.HandleFunc("/u/", withCtx(handleUser, 0))
	http.HandleFunc("/n/", withCtx(handleNote, OnlyGet))
	http.HandleFunc("/idx/allnotes", withCtx(handleIndexAllNotes, OnlyGet))
	http.HandleFunc("/logintwitter", handleLoginTwitter)
	http.HandleFunc("/logintwittercb", handleOauthTwitterCallback)
	http.HandleFunc("/logingithub", handleLoginGitHub)
	http.HandleFunc("/logingithubcb", handleOauthGitHubCallback)
	http.HandleFunc("/logingoogle", handleLoginGoogle)
	http.HandleFunc("/logingooglecb", handleOauthGoogleCallback)

	http.HandleFunc("/logout", handleLogout)
	http.HandleFunc("/api/import_simplenote_start", withCtx(handleAPIImportSimpleNoteStart, OnlyLoggedIn|IsJSON))
	http.HandleFunc("/api/import_simplenote_status", withCtx(handleAPIImportSimpleNotesStatus, OnlyLoggedIn|IsJSON))
	http.HandleFunc("/api/getnotes", withCtx(handleAPIGetNotes, IsJSON))
	http.HandleFunc("/api/getnote", withCtx(handleAPIGetNote, IsJSON))
	http.HandleFunc("/api/searchusernotes", withCtx(handleSearchUserNotes, IsJSON))
	http.HandleFunc("/api/createorupdatenote", withCtx(handleAPICreateOrUpdateNote, IsJSON|OnlyLoggedIn))
	http.HandleFunc("/api/deletenote", withCtx(handleAPIDeleteNote, IsJSON|OnlyLoggedIn))
	http.HandleFunc("/api/permanentdeletenote", withCtx(handleAPIPermanentDeleteNote, IsJSON|OnlyLoggedIn))
	http.HandleFunc("/api/undeletenote", withCtx(handleAPIUndeleteNote, IsJSON|OnlyLoggedIn))
	http.HandleFunc("/api/makenoteprivate", withCtx(handleAPIMakeNotePrivate, IsJSON|OnlyLoggedIn))
	http.HandleFunc("/api/makenotepublic", withCtx(handleAPIMakeNotePublic, IsJSON|OnlyLoggedIn))
	http.HandleFunc("/api/starnoten", withCtx(handleAPIStarNote, IsJSON|OnlyLoggedIn))
	http.HandleFunc("/api/unstarnote", withCtx(handleAPIUnstarNote, IsJSON|OnlyLoggedIn))
	http.HandleFunc("/api/getrecentnotes", withCtx(handleAPIGetRecentNotes, IsJSON))
}

func startWebServer() {
	registerHTTPHandlers()
	fmt.Printf("Started runing on %s\n", httpAddr)
	if err := http.ListenAndServe(httpAddr, nil); err != nil {
		fmt.Printf("http.ListendAndServer() failed with %s\n", err)
	}
	fmt.Printf("Exited\n")
}
