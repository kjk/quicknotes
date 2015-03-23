package main

import (
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
		LogInfof("url: '%s', user: %d, login: '%s', handle: '%s'\n", uri, dbUser.ID, dbUser.Login.String, dbUser.Handle.String)
	} else {
		LogInfof("url: '%s'\n", uri)
	}

	model := struct {
		UserHandle string
	}{}
	if dbUser != nil {
		model.UserHandle = dbUser.Handle.String
	}
	execTemplate(w, tmplIndex, model)
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
		ColorsCSS    string
		UserHandle   string
		LoggedInUser *DbUser
		Notes        []*Note
	}{
		ColorsCSS:    colorsCssString,
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
	model := struct {
		Note *Note
	}{
		Note: note,
	}
	execTemplate(w, tmplNote, model)
}

// /api/getnote.json?id={note_id_hash}
func handleAPIGetNote(w http.ResponseWriter, r *http.Request) {
	noteIDHashStr := r.FormValue("id")
	note := getNoteByIDHash(w, r, noteIDHashStr)
	if note == nil {
		httpErrorWithJSONf(w, "/api/getnote.json: missing or invalid id attribute '%s'", noteIDHashStr)
		return
	}

	content, err := getCachedContent(note.ContentSha1)
	if err != nil {
		LogErrorf("getCachedContent() failed with %s\n", err)
		httpErrorWithJSONf(w, "/api/getnote.json: getCachedContent() failed with %s", err)
		return
	}
	v := struct {
		IDHash  string
		Title   string
		ColorID int
		Format  int
		Content string
		Tags    []string
	}{
		IDHash:  noteIDHashStr,
		Title:   note.Title,
		ColorID: note.ColorID,
		Format:  note.Format,
		Content: string(content),
		Tags:    note.Tags,
	}
	httpOkWithJSON(w, v)
}

// /api/getnotes.json?user=${userHandle}&start=${start}&len=${len}
func handleAPIGetNotes(w http.ResponseWriter, r *http.Request) {
	userHandle := strings.TrimSpace(r.FormValue("user"))
	LogInfof("userHandle: '%s'\n", userHandle)
	if userHandle == "" {
		http.NotFound(w, r)
		return
	}
	// TODO: get start, len
	/*
		start := strings.TrimSpace(r.FormValue("start"))
		nStart, err := strconv.Atoi(start)
		if err != nil {
			http.NotFound(w, r)
			return
		}*/

	i, err := getCachedUserInfoByHandle(userHandle)
	if err != nil || i == nil {
		httpServerError(w, r)
		return
	}
	loggedInUserHandle := ""
	dbUser := getUserFromCookie(w, r)
	if dbUser != nil {
		loggedInUserHandle = dbUser.Handle.String
	}

	onlyPublic := userHandle != loggedInUserHandle
	// TODO: hack, set CachedSnippet
	var notes []*Note
	for _, note := range i.notes {
		if onlyPublic {
			if note.IsPublic {
				notes = append(notes, note)
			}
		} else {
			notes = append(notes, note)
		}
	}

	LogInfof("%d notes of user '%s' ('%s'), logged in user: '%s', onlyPublic: %v\n", len(notes), userHandle, i.user.Handle.String, loggedInUserHandle, onlyPublic)
	v := struct {
		LoggedInUserHandle string
		Notes              []*Note
	}{
		LoggedInUserHandle: loggedInUserHandle,
		Notes:              notes,
	}
	httpOkWithJSON(w, v)
}

func newNoteFromArgs(r *http.Request) *NewNote {
	var note NewNote
	formatArg := strings.TrimSpace(r.FormValue("format"))
	note.format = formatFromString(formatArg)
	if note.format == formatInvalid {
		return nil
	}
	note.content = []byte(strings.TrimSpace(r.FormValue("content")))
	if len(note.content) == 0 {
		return nil
	}
	note.title = strings.TrimSpace(r.FormValue("title"))
	if note.title == "" && note.format == formatText {
		note.title, note.content = noteToTitleContent(note.content)
	}
	tagsArg := strings.TrimSpace(r.FormValue("tags"))
	note.tags = deserializeTags(tagsArg)
	isPublicArg := strings.TrimSpace(r.FormValue("ispublic"))
	note.isPublic = boolFromString(isPublicArg)
	return &note
}

// POST /api/createorupdatenote.json
//  noteIdHash : if given, this is an update, if not, this is create new
//  title      : (optional)
//  format     : "text", "0", "markdown", "1"
//  content    : text of the note
//  ispublic   : "true", "1", "false", "0"
//  tags       : tag1,tag2,tag3, can be empty
func handleAPICreateNote(w http.ResponseWriter, r *http.Request) {
	LogInfof("url: '%s'\n", r.URL)
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil {
		LogErrorf("not logged int\n")
		httpErrorWithJSONf(w, "user not logged in")
		return
	}
	// TODO: notIDHash not supported yet
	note := newNoteFromArgs(r)
	if note == nil {
		LogErrorf("newNoteFromArgs() returned nil\n")
		httpErrorWithJSONf(w, "newNoteFromArgs() returned nil")
		return
	}

	noteID, err := dbCreateNewNote(dbUser.ID, note)
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

// GET /api/undeletenote.json
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
	//http.HandleFunc("/logingoogle", handleLoginGoogle)
	http.HandleFunc("/logout", handleLogout)
	http.HandleFunc("/importsimplenote", handleImportSimpleNote)
	http.HandleFunc("/api/getnotes.json", handleAPIGetNotes)
	http.HandleFunc("/api/getnote.json", handleAPIGetNote)
	http.HandleFunc("/api/createorupdatenote.json", handleAPICreateNote)
	http.HandleFunc("/api/deletenote.json", handleAPIDeleteNote)
	http.HandleFunc("/api/undeletenote.json", handleAPIUndeleteNote)
	http.HandleFunc("/api/makenoteprivate.json", handleAPIMakeNotePrivate)
	http.HandleFunc("/api/makenotepublic.json", handleAPIMakeNotePublic)
	http.HandleFunc("/api/starnote.json", handleAPIStarNote)
	http.HandleFunc("/api/unstarnote.json", handleAPIUnstarNote)
}

func startWebServer() {
	registerHTTPHandlers()
	fmt.Printf("Started runing on %s\n", httpAddr)
	if err := http.ListenAndServe(httpAddr, nil); err != nil {
		fmt.Printf("http.ListendAndServer() failed with %s\n", err)
	}
	fmt.Printf("Exited\n")
}
