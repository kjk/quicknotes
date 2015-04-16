package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/kjk/u"
)

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
		LogInfof("url: '%s', user: %d, login: '%s', handle: '%s'\n", uri, dbUser.ID, dbUser.Login, dbUser.Handle)
	} else {
		LogInfof("url: '%s'\n", uri)
	}

	model := struct {
		LoggedInUserHandle string
	}{}
	if dbUser != nil {
		model.LoggedInUserHandle = dbUser.Handle
	}
	execTemplate(w, tmplIndex, model)
}

func handleImport(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	dbUser := getUserFromCookie(w, r)
	if dbUser != nil {
		LogInfof("url: '%s', user: %d, login: '%s', handle: '%s'\n", uri, dbUser.ID, dbUser.Login, dbUser.Handle)
	} else {
		LogInfof("url: '%s'\n", uri)
	}

	model := struct {
		LoggedInUserHandle string
	}{}
	if dbUser != nil {
		model.LoggedInUserHandle = dbUser.Handle
	}
	execTemplate(w, tmplImport, model)
}

func handleFavicon(w http.ResponseWriter, r *http.Request) {
	http.NotFound(w, r)
}

// /s/$rest
func handleStatic(w http.ResponseWriter, r *http.Request) {
	fileName := r.URL.Path[len("/s/"):]
	path := filepath.Join("s", fileName)
	if u.PathExists(path) {
		http.ServeFile(w, r, path)
	} else {
		LogInfof("file %q doesn't exist, referer: %q\n", fileName, getReferer(r))
		http.NotFound(w, r)
	}
}

// /u/{user_handle}
func handleUser(w http.ResponseWriter, r *http.Request) {
	userHandle := r.URL.Path[len("/u/"):]
	i, err := getCachedUserInfoByHandle(userHandle)
	if err != nil || i == nil {
		LogInfof("no user '%s', url: '%s', err: %s\n", userHandle, r.URL, err)
		http.NotFound(w, r)
		return
	}
	LogInfof("%d notes for user '%s'\n", len(i.notes), userHandle)
	model := struct {
		UserHandle   string
		LoggedInUser *DbUser
		Notes        []*Note
	}{
		UserHandle:   userHandle,
		LoggedInUser: i.user,
		Notes:        i.notes,
	}
	execTemplate(w, tmplUser, model)
}

func getNoteByIDHash(w http.ResponseWriter, r *http.Request, noteIDHashStr string) *Note {
	noteIDHashStr = strings.TrimSpace(noteIDHashStr)
	noteID := dehashInt(noteIDHashStr)
	LogInfof("note id hash: '%s', id: %d\n", noteIDHashStr, noteID)
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		return nil
	}
	if note.IsPublic {
		return note
	}
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil || dbUser.ID != note.userID {
		// not authorized to view this note
		// TODO: when we have sharing via secret link we'll have to check
		// permissions
		return nil
	}
	return note
}

// /n/{note_id_hash}-rest
func handleNote(w http.ResponseWriter, r *http.Request) {
	noteIDHashStr := r.URL.Path[len("/n/"):]
	// remove optional part after -, which is constructed from note title
	if idx := strings.Index(noteIDHashStr, "-"); idx != -1 {
		noteIDHashStr = noteIDHashStr[:idx]
	}

	note := getNoteByIDHash(w, r, noteIDHashStr)
	if note == nil {
		http.NotFound(w, r)
		return
	}

	loggedInUserHandle := ""
	dbUser := getUserFromCookie(w, r)
	if dbUser != nil {
		loggedInUserHandle = dbUser.Handle
	}

	model := struct {
		Note               *Note
		LoggedInUserHandle string
	}{
		Note:               note,
		LoggedInUserHandle: loggedInUserHandle,
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
	res := 0
	res += 1 * boolToInt(n.IsStarred)
	res += 2 * boolToInt(n.IsDeleted)
	res += 4 * boolToInt(n.IsPublic)
	res += 8 * boolToInt(n.IsPartial)
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

// /api/getnotecompact.json?id=${note_id_hash}
func handleAPIGetNoteCompact(w http.ResponseWriter, r *http.Request) {
	dbUser := getUserFromCookie(w, r)
	noteIDHashStr := r.FormValue("id")
	note := getNoteByIDHash(w, r, noteIDHashStr)
	if note == nil {
		httpErrorWithJSONf(w, "/api/getnote.json: missing or invalid id attribute '%s'", noteIDHashStr)
		return
	}
	if !note.IsPublic && note.userID != dbUser.ID {
		httpErrorWithJSONf(w, "/api/getnote.json access denied")
	}
	// TODO: return error if the note doesn't belong to logged in user
	content, err := getCachedContent(note.ContentSha1)
	if err != nil {
		LogErrorf("getCachedContent() failed with %s\n", err)
		httpErrorWithJSONf(w, "/api/getnote.json: getCachedContent() failed with %s", err)
		return
	}
	v := noteToCompact(note)
	v[noteContentIdx] = string(content)
	httpOkWithJSON(w, v)
}

// /api/getnotescompact.json
// Arguments:
//  - user : userHandle
//  - jsonp : jsonp wrapper, optional
func handleAPIGetNotesCompact(w http.ResponseWriter, r *http.Request) {
	userHandle := strings.TrimSpace(r.FormValue("user"))
	jsonp := strings.TrimSpace(r.FormValue("jsonp"))
	LogInfof("userHandle: '%s', jsonp: '%s'\n", userHandle, jsonp)
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
	LogInfof("%d notes of user '%s' ('%s'), logged in user: '%s', showPrivate: %v\n", len(notes), userHandle, i.user.Handle, loggedInUserHandle, showPrivate)
	v := struct {
		LoggedInUserHandle string
		Notes              [][]interface{}
	}{
		LoggedInUserHandle: loggedInUserHandle,
		Notes:              notes,
	}
	httpOkWithJsonpCompact(w, v, jsonp)
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
		LogInfof("missing noteJSON value\n")
		return nil
	}
	fmt.Printf("json: '%s'\n", noteJSON)
	err := json.Unmarshal([]byte(noteJSON), &note)
	if err != nil {
		LogInfof("json.Unmarshal('%s') failed with %s", noteJSON, err)
		return nil
	}
	//LogInfof("note: %s\n", noteJSON)
	if !isValidFormat(note.Format) {
		LogInfof("invalid format %d\n", note.Format)
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

// POST /api/createorupdatenote.json
//  noteJSON : note serialized as json in array format
func handleAPICreateOrUpdateNote(w http.ResponseWriter, r *http.Request) {
	LogInfof("url: '%s'\n", r.URL)
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil {
		LogErrorf("not logged in\n")
		httpErrorWithJSONf(w, "user not logged in")
		return
	}
	note := newNoteFromArgs(r)
	if note == nil {
		LogErrorf("newNoteFromArgs() returned nil\n")
		httpErrorWithJSONf(w, "newNoteFromArgs() returned nil")
		return
	}

	noteID, err := dbCreateOrUpdateNote(dbUser.ID, note)
	if err != nil {
		LogErrorf("dbCreateNewNote() failed with %s\n", err)
		httpErrorWithJSONf(w, "dbCreateNewNot() failed with '%s'", err)
		return
	}
	v := struct {
		IDStr string
	}{
		IDStr: hashInt(noteID),
	}
	httpOkWithJSON(w, v)
}

func getUserNoteFromArgs(w http.ResponseWriter, r *http.Request) (*DbUser, int) {
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil {
		LogErrorf("not logged int\n")
		httpErrorWithJSONf(w, "user not logged in")
		return nil, 0
	}

	noteIDHashStr := strings.TrimSpace(r.FormValue("noteIdHash"))
	noteID := dehashInt(noteIDHashStr)
	LogInfof("note id hash: '%s', id: %d\n", noteIDHashStr, noteID)
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		httpErrorWithJSONf(w, "note doesn't exist")
		return nil, 0
	}
	if note.userID != dbUser.ID {
		httpErrorWithJSONf(w, "note doesn't belong to this user")
		return nil, 0
	}
	return dbUser, noteID
}

// GET /api/deletenote.json
// args:
// - noteIdHash
func handleAPIDeleteNote(w http.ResponseWriter, r *http.Request) {
	LogInfof("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbDeleteNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to delete note with '%s'", err)
		return
	}
	LogInfof("deleted note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "note has been deleted",
	}
	httpOkWithJSON(w, v)
}

// POST /api/permanentdeletenote.json
// args:
// - noteIdHash
func handleAPIPermanentDeleteNote(w http.ResponseWriter, r *http.Request) {
	LogInfof("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbPermanentDeleteNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to permanently delete note with '%s'", err)
		return
	}
	LogInfof("permanently deleted note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "note has been permanently deleted",
	}
	httpOkWithJSON(w, v)
}

// POST /api/undeletenote.json
// args:
// - noteIdHash
func handleAPIUndeleteNote(w http.ResponseWriter, r *http.Request) {
	LogInfof("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbUndeleteNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to undelete note with '%s'", err)
		return
	}
	LogInfof("undeleted note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "note has been undeleted",
	}
	httpOkWithJSON(w, v)
}

// GET /api/makenoteprivate.json
// args:
// - noteIdHash
func handleAPIMakeNotePrivate(w http.ResponseWriter, r *http.Request) {
	LogInfof("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbMakeNotePrivate(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to make note private with '%s'", err)
		return
	}
	LogInfof("made note %d private\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "made note private",
	}
	httpOkWithJSON(w, v)
}

// GET /api/makenotepublic.json
// args:
// - noteIdHash
func handleAPIMakeNotePublic(w http.ResponseWriter, r *http.Request) {
	LogInfof("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbMakeNotePublic(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to make note public with '%s'", err)
		return
	}
	LogInfof("made note %d public\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "made note public",
	}
	httpOkWithJSON(w, v)
}

// GET /api/starnote.json
// args:
// - noteIdHash
func handleAPIStarNote(w http.ResponseWriter, r *http.Request) {
	LogInfof("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbStarNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to star note with '%s'", err)
		return
	}
	LogInfof("starred note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "starred note",
	}
	httpOkWithJSON(w, v)
}

// GET /api/unstarnote.json
// args:
// - noteIdHash
func handleAPIUnstarNote(w http.ResponseWriter, r *http.Request) {
	LogInfof("url: '%s'\n", r.URL)
	dbUser, noteID := getUserNoteFromArgs(w, r)
	if dbUser == nil {
		return
	}
	err := dbUnstarNote(dbUser.ID, noteID)
	if err != nil {
		httpErrorWithJSONf(w, "failed to unstar note with '%s'", err)
		return
	}
	LogInfof("unstarred note %d\n", noteID)
	v := struct {
		Msg string
	}{
		Msg: "unstarred note",
	}
	httpOkWithJSON(w, v)
}

// GET /api/tohtml.json
// args:
// - content
// - format
func handleAPIToHTML(w http.ResponseWriter, r *http.Request) {
	httpErrorWithJSONf(w, "NYI")
}

func registerHTTPHandlers() {
	http.HandleFunc("/", handleIndex)
	http.HandleFunc("/favicon.ico", handleFavicon)
	http.HandleFunc("/s/", handleStatic)
	http.HandleFunc("/u/", handleUser)
	http.HandleFunc("/n/", handleNote)
	http.HandleFunc("/import", handleImport)
	http.HandleFunc("/logintwitter", handleLoginTwitter)
	http.HandleFunc("/logintwittercb", handleOauthTwitterCallback)
	http.HandleFunc("/logingithub", handleLoginGitHub)
	http.HandleFunc("/logingithubcb", handleOauthGitHubCallback)
	http.HandleFunc("/logingoogle", handleLoginGoogle)
	http.HandleFunc("/logingooglecb", handleOauthGoogleCallback)

	//http.HandleFunc("/logingoogle", handleLoginGoogle)
	http.HandleFunc("/logout", handleLogout)
	http.HandleFunc("/importsimplenote", handleImportSimpleNote)
	http.HandleFunc("/api/getnotescompact.json", handleAPIGetNotesCompact)
	http.HandleFunc("/api/getnotecompact.json", handleAPIGetNoteCompact)
	http.HandleFunc("/api/searchusernotes.json", handleSearchUserNotes)
	http.HandleFunc("/api/createorupdatenote.json", handleAPICreateOrUpdateNote)
	http.HandleFunc("/api/deletenote.json", handleAPIDeleteNote)
	http.HandleFunc("/api/permanentdeletenote.json", handleAPIPermanentDeleteNote)
	http.HandleFunc("/api/undeletenote.json", handleAPIUndeleteNote)
	http.HandleFunc("/api/makenoteprivate.json", handleAPIMakeNotePrivate)
	http.HandleFunc("/api/makenotepublic.json", handleAPIMakeNotePublic)
	http.HandleFunc("/api/starnote.json", handleAPIStarNote)
	http.HandleFunc("/api/unstarnote.json", handleAPIUnstarNote)
	http.HandleFunc("/api/tohtml.json", handleAPIToHTML)
}

func startWebServer() {
	registerHTTPHandlers()
	fmt.Printf("Started runing on %s\n", httpAddr)
	if err := http.ListenAndServe(httpAddr, nil); err != nil {
		fmt.Printf("http.ListendAndServer() failed with %s\n", err)
	}
	fmt.Printf("Exited\n")
}
