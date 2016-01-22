package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/kjk/log"
	"github.com/kjk/u"
)

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
		//log.Infof("Loaded '%s' of size %d bytes\n", name, len(d))
		resourcesFromZip[name] = d
	}
	return nil
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
		log.Infof(" in %s\n", time.Since(timeStart))
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

	log.Infof("serving '%s' from zip, hasGzippedVersion: %v\n", path, len(gzippedData) > 0)

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
/ - main page, tbd (show public notes, on-boarding for new users?)
/latest - show latest public notes
/s/{path} - static files
/u/{name} - main page for a given user. Shows read-write UI if it's a logged-in
            user. Show public messages of user if not this logged-in user
/n/{note_id} - show a single note
/api/*.json - api calls
*/

func handleIndex(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	if uri != "/" {
		http.NotFound(w, r)
		return
	}
	dbUser := getUserFromCookie(w, r)
	/*
		name := r.URL.Path[1:]
		if strings.HasSuffix(name, ".html") {
			path := filepath.Join("s", name)
			if u.PathExists(path) {
				http.ServeFile(w, r, path)
				return
			}
		}*/

	if dbUser != nil {
		log.Infof("url: '%s', user: %d, login: '%s', handle: '%s'\n", uri, dbUser.ID, dbUser.Login, dbUser.Handle)
	} else {
		log.Infof("url: '%s'\n", uri)
	}

	model := struct {
		LoggedInUserHandle string
	}{}
	if dbUser != nil {
		model.LoggedInUserHandle = dbUser.Handle
	}
	execTemplate(w, tmplIndex, model)
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
	} else {
		log.Infof("file %q doesn't exist, referer: %q\n", fileName, getReferer(r))
		http.NotFound(w, r)
	}
}

// /u/{user_handle}
func handleUser(w http.ResponseWriter, r *http.Request) {
	userHandle := r.URL.Path[len("/u/"):]
	i, err := getCachedUserInfoByHandle(userHandle)
	if err != nil || i == nil {
		log.Infof("no user '%s', url: '%s', err: %s\n", userHandle, r.URL, err)
		http.NotFound(w, r)
		return
	}
	log.Infof("%d notes for user '%s'\n", len(i.notes), userHandle)
	model := struct {
		UserHandle         string
		LoggedInUserHandle string
		Notes              []*Note
	}{
		UserHandle: userHandle,
		Notes:      i.notes,
	}
	dbUser := getUserFromCookie(w, r)
	if dbUser != nil {
		model.LoggedInUserHandle = dbUser.Handle
	}
	execTemplate(w, tmplUser, model)
}

func userCanAccessNote(dbUser *DbUser, note *Note) bool {
	if note.IsPublic {
		return true
	}
	if dbUser == nil {
		return false
	}
	return dbUser.ID == note.userID
}

func getNoteByIDHash(w http.ResponseWriter, r *http.Request, noteIDHashStr string) (*Note, error) {
	noteIDHashStr = strings.TrimSpace(noteIDHashStr)
	noteID, err := dehashInt(noteIDHashStr)
	if err != nil {
		return nil, err
	}
	log.Verbosef("note id hash: '%s', id: %d\n", noteIDHashStr, noteID)
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		return nil, err
	}
	dbUser := getUserFromCookie(w, r)
	// TODO: when we have sharing via secret link we'll have to check
	// permissions
	if !userCanAccessNote(dbUser, note) {
		return nil, fmt.Errorf("no access to note '%s'", noteIDHashStr)
	}
	return note, nil
}

// /n/{note_id_hash}-rest
func handleNote(w http.ResponseWriter, r *http.Request) {
	noteIDHashStr := r.URL.Path[len("/n/"):]
	// remove optional part after -, which is constructed from note title
	if idx := strings.Index(noteIDHashStr, "-"); idx != -1 {
		noteIDHashStr = noteIDHashStr[:idx]
	}

	note, err := getNoteByIDHash(w, r, noteIDHashStr)
	if err != nil || note == nil {
		log.Error(err)
		http.NotFound(w, r)
		return
	}

	loggedInUserHandle := ""
	dbUser := getUserFromCookie(w, r)
	if dbUser != nil {
		loggedInUserHandle = dbUser.Handle
	}

	dbNoteUser, err := dbGetUserByID(note.userID)
	if err != nil {
		httpErrorf(w, "dbGetUserByID(%d) failed with %s", note.userID, err)
		return
	}
	noteUserHandle := ""
	if dbNoteUser != nil {
		noteUserHandle = dbNoteUser.Handle
	}

	model := struct {
		NoteTitle            string
		NoteTitleJS          string
		NoteBodyJS           string
		NoteFormat           string
		LoggedInUserHandleJS string
		NoteUserHandleJS     string
	}{
		NoteTitle:            note.Title,
		NoteTitleJS:          template.JSEscapeString(note.Title),
		NoteBodyJS:           template.JSEscapeString(note.Content()),
		NoteFormat:           formatNameFromID(note.Format),
		LoggedInUserHandleJS: template.JSEscapeString(loggedInUserHandle),
		NoteUserHandleJS:     template.JSEscapeString(noteUserHandle),
	}
	execTemplate(w, tmplNote, model)
}

const (
	noteHashIDIdx = iota
	noteTitleIdx
	noteSizeIdx
	noteFlagsIdx
	noteCreatedAtIdx
	noteTagsIdx
	noteSnippetIdx
	noteFormatIdx
	noteCurrentVersionIDIdx
	noteContentIdx
	//noteUpdatedAtIdx
	noteFieldsCount
)

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// encode multiple bool flags as a single int
func encodeNoteFlags(n *Note) int {
	res := 1 * boolToInt(n.IsStarred)
	res += 2 * boolToInt(n.IsDeleted)
	res += 4 * boolToInt(n.IsPublic)
	res += 8 * boolToInt(n.IsPartial)
	res += 16 * boolToInt(n.IsTruncated)
	return res
}

func isBitSet(flags int, nBit uint) bool {
	return flags&(1<<nBit) != 0
}

func noteToCompact(n *Note) []interface{} {
	res := make([]interface{}, noteFieldsCount, noteFieldsCount)
	res[noteHashIDIdx] = n.IDStr
	res[noteTitleIdx] = n.Title
	res[noteSizeIdx] = n.Size
	res[noteFlagsIdx] = encodeNoteFlags(n)
	res[noteCreatedAtIdx] = n.CreatedAt
	//res[noteUpdatedAtIdx] = n.CreatedAt // TODO: UpdatedAt
	res[noteTagsIdx] = n.Tags
	res[noteSnippetIdx] = n.Snippet
	res[noteFormatIdx] = n.Format
	res[noteCurrentVersionIDIdx] = n.CurrVersionID
	return res
}

// /api/getnote?id=${note_id_hash}
func handleAPIGetNote(w http.ResponseWriter, r *http.Request) {
	dbUser := getUserFromCookie(w, r)
	noteIDHashStr := r.FormValue("id")
	note, err := getNoteByIDHash(w, r, noteIDHashStr)
	if err != nil || note == nil {
		log.Error(err)
		httpErrorWithJSONf(w, "/api/getnote.json: missing or invalid id attribute '%s'", noteIDHashStr)
		return
	}
	if !userCanAccessNote(dbUser, note) {
		httpErrorWithJSONf(w, "/api/getnote.json access denied")
		return
	}
	content, err := getCachedContent(note.ContentSha1)
	if err != nil {
		log.Errorf("getCachedContent() failed with %s\n", err)
		httpErrorWithJSONf(w, "/api/getnote.json: getCachedContent() failed with %s", err)
		return
	}
	v := noteToCompact(note)
	v[noteContentIdx] = string(content)
	httpOkWithJSON(w, r, v)
}

// /api/getnotes
// Arguments:
//  - user : userHandle
//  - jsonp : jsonp wrapper, optional
func handleAPIGetNotes(w http.ResponseWriter, r *http.Request) {
	userHandle := strings.TrimSpace(r.FormValue("user"))
	jsonp := strings.TrimSpace(r.FormValue("jsonp"))
	log.Infof("userHandle: '%s', jsonp: '%s'\n", userHandle, jsonp)
	if userHandle == "" {
		http.NotFound(w, r)
		return
	}
	i, err := getCachedUserInfoByHandle(userHandle)
	if err != nil || i == nil {
		httpServerError(w, r)
		return
	}
	loggedInUserHandle := ""
	dbUser := getUserFromCookie(w, r)
	if dbUser != nil {
		loggedInUserHandle = dbUser.Handle
	}

	showPrivate := userHandle == loggedInUserHandle
	var notes [][]interface{}
	for _, note := range i.notes {
		if note.IsPublic || showPrivate {
			notes = append(notes, noteToCompact(note))
		}
	}
	log.Infof("%d notes of user '%s' ('%s'), logged in user: '%s', showPrivate: %v\n", len(notes), userHandle, i.user.Handle, loggedInUserHandle, showPrivate)
	v := struct {
		LoggedInUserHandle string
		Notes              [][]interface{}
	}{
		LoggedInUserHandle: loggedInUserHandle,
		Notes:              notes,
	}
	httpOkWithJsonpCompact(w, r, v, jsonp)
}

// /api/getrecentnotes
// Arguments:
//  - limit : max notes, to retrieve, 25 if not given
//  - jsonp : jsonp wrapper, optional
// TODO: allow getting private notes, for admin uses
func handleAPIGetRecentNotes(w http.ResponseWriter, r *http.Request) {
	jsonp := strings.TrimSpace(r.FormValue("jsonp"))
	limitStr := strings.TrimSpace(r.FormValue("limit"))
	log.Infof("jsonp: '%s', limit: '%s'\n", jsonp, limitStr)
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit == 0 {
		limit = 25
	}
	recentNotes, err := getRecentPublicNotesCached(limit)
	if err != nil {
		log.Errorf("getRecentPublicNotesCached() failed with %s\n", err)
		httpServerError(w, r)
		return
	}
	httpOkWithJsonpCompact(w, r, recentNotes, jsonp)
}

// NewNoteFromBrowser represents format of the note sent by the browser
type NewNoteFromBrowser struct {
	IDStr    string
	Title    string
	Format   int
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
	//log.Infof("note: %s\n", noteJSON)
	if !isValidFormat(note.Format) {
		log.Errorf("invalid format %d\n", note.Format)
		return nil
	}
	newNote.idStr = note.IDStr
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

// POST /api/createorupdatenote
//  noteJSON : note serialized as json in array format
func handleAPICreateOrUpdateNote(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil {
		log.Errorf("not logged in\n")
		httpErrorWithJSONf(w, "user not logged in")
		return
	}
	note := newNoteFromArgs(r)
	if note == nil {
		log.Errorf("newNoteFromArgs() returned nil\n")
		httpErrorWithJSONf(w, "newNoteFromArgs() returned nil")
		return
	}

	noteID, err := dbCreateOrUpdateNote(dbUser.ID, note)
	if err != nil {
		log.Errorf("dbCreateNewNote() failed with %s\n", err)
		httpErrorWithJSONf(w, "dbCreateNewNot() failed with '%s'", err)
		return
	}
	v := struct {
		IDStr string
	}{
		IDStr: hashInt(noteID),
	}
	httpOkWithJSON(w, nil, v)
}

func getUserNoteFromArgs(w http.ResponseWriter, r *http.Request) (*DbUser, int) {
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil {
		log.Errorf("not logged int\n")
		httpErrorWithJSONf(w, "user not logged in")
		return nil, 0
	}

	noteIDHashStr := strings.TrimSpace(r.FormValue("noteIdHash"))
	noteID, err := dehashInt(noteIDHashStr)
	if err != nil {
		log.Error(err)
		httpErrorWithJSONf(w, "ivalid note id '%s'", noteIDHashStr)
		return nil, 0
	}
	log.Verbosef("note id hash: '%s', id: %d\n", noteIDHashStr, noteID)
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		log.Error(err)
		httpErrorWithJSONf(w, "note doesn't exist")
		return nil, 0
	}
	if note.userID != dbUser.ID {
		log.Errorf("note '%s' doesn't belong to user '%s'\n", noteIDHashStr, dbUser.Handle)
		httpErrorWithJSONf(w, "note doesn't belong to this user")
		return nil, 0
	}
	return dbUser, noteID
}

// GET /api/deletenote
// args:
// - noteIdHash
func handleAPIDeleteNote(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbDeleteNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to delete note with '%s'", err)
		return
	}
	log.Verbosef("deleted note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "note has been deleted",
	}
	httpOkWithJSON(w, nil, v)
}

// POST /api/permanentdeletenote
// args:
// - noteIdHash
func handleAPIPermanentDeleteNote(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbPermanentDeleteNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to permanently delete note with '%s'", err)
		return
	}
	log.Verbosef("permanently deleted note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "note has been permanently deleted",
	}
	httpOkWithJSON(w, nil, v)
}

// POST /api/undeletenote
// args:
// - noteIdHash
func handleAPIUndeleteNote(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbUndeleteNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to undelete note with '%s'", err)
		return
	}
	log.Verbosef("undeleted note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "note has been undeleted",
	}
	httpOkWithJSON(w, nil, v)
}

// GET /api/makenoteprivate
// args:
// - noteIdHash
func handleAPIMakeNotePrivate(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbMakeNotePrivate(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to make note private with '%s'", err)
		return
	}
	log.Verbosef("made note %d private\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "made note private",
	}
	httpOkWithJSON(w, nil, v)
}

// GET /api/makenotepublic
// args:
// - noteIdHash
func handleAPIMakeNotePublic(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbMakeNotePublic(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to make note public with '%s'", err)
		return
	}
	log.Infof("made note %d public\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "made note public",
	}
	httpOkWithJSON(w, nil, v)
}

// GET /api/starnote
// args:
// - noteIdHash
func handleAPIStarNote(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbStarNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to star note with '%s'", err)
		return
	}
	log.Verbosef("starred note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "starred note",
	}
	httpOkWithJSON(w, nil, v)
}

// GET /api/unstarnote
// args:
// - noteIdHash
func handleAPIUnstarNote(w http.ResponseWriter, r *http.Request) {
	log.Verbosef("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbUnstarNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to unstar note with '%s'", err)
		return
	}
	log.Verbosef("unstarred note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "unstarred note",
	}
	httpOkWithJSON(w, nil, v)
}

func registerHTTPHandlers() {
	http.HandleFunc("/", handleIndex)
	http.HandleFunc("/favicon.ico", handleFavicon)
	http.HandleFunc("/s/", handleStatic)
	http.HandleFunc("/u/", handleUser)
	http.HandleFunc("/n/", handleNote)
	http.HandleFunc("/logintwitter", handleLoginTwitter)
	http.HandleFunc("/logintwittercb", handleOauthTwitterCallback)
	http.HandleFunc("/logingithub", handleLoginGitHub)
	http.HandleFunc("/logingithubcb", handleOauthGitHubCallback)
	http.HandleFunc("/logingoogle", handleLoginGoogle)
	http.HandleFunc("/logingooglecb", handleOauthGoogleCallback)

	//http.HandleFunc("/logingoogle", handleLoginGoogle)
	http.HandleFunc("/logout", handleLogout)
	http.HandleFunc("/api/import_simplenote_start", handleAPIImportSimpleNoteStart)
	http.HandleFunc("/api/import_simplenote_status", handleAPIImportSimpleNotesStatus)
	http.HandleFunc("/api/getnotes", handleAPIGetNotes)
	http.HandleFunc("/api/getnotec", handleAPIGetNote)
	http.HandleFunc("/api/searchusernotes", handleSearchUserNotes)
	http.HandleFunc("/api/createorupdatenote", handleAPICreateOrUpdateNote)
	http.HandleFunc("/api/deletenote", handleAPIDeleteNote)
	http.HandleFunc("/api/permanentdeletenote", handleAPIPermanentDeleteNote)
	http.HandleFunc("/api/undeletenote", handleAPIUndeleteNote)
	http.HandleFunc("/api/makenoteprivate", handleAPIMakeNotePrivate)
	http.HandleFunc("/api/makenotepublic", handleAPIMakeNotePublic)
	http.HandleFunc("/api/starnoten", handleAPIStarNote)
	http.HandleFunc("/api/unstarnote", handleAPIUnstarNote)
	http.HandleFunc("/api/getrecentnotes", handleAPIGetRecentNotes)
}

func startWebServer() {
	registerHTTPHandlers()
	fmt.Printf("Started runing on %s\n", httpAddr)
	if err := http.ListenAndServe(httpAddr, nil); err != nil {
		fmt.Printf("http.ListendAndServer() failed with %s\n", err)
	}
	fmt.Printf("Exited\n")
}
