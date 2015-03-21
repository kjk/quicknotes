package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/kjk/u"
)

func httpOkBytesWithContentType(w http.ResponseWriter, contentType string, content []byte) {
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(content)))
	w.Write(content)
}

func httpOkWithText(w http.ResponseWriter, s string) {
	w.Header().Set("Content-Type", "text/plain")
	io.WriteString(w, s)
}

func httpOkWithJSON(w http.ResponseWriter, v interface{}) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		// should never happen
		LogErrorf("json.MarshalIndent() failed with %q\n", err)
	}
	httpOkBytesWithContentType(w, "application/json", b)
}

func httpJSONError(w http.ResponseWriter, format string, arg ...interface{}) {
	msg := fmt.Sprintf(format, arg...)
	model := struct {
		Error string
	}{
		Error: msg,
	}
	httpOkWithJSON(w, model)
}

func httpServerError(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "internal server error", http.StatusInternalServerError)
}

/*
Big picture:
/ - main page, tbd (show public notes, on-boarding for new users?)
/latest - show latest public notes
/s/{path} - static files
/u/{name} - main page for a given user. Shows read-write UI if it's a logged-in
            user. Show public messages of user if not this logged-in user
/n/{note_id} - show a single note
*/

func handleIndex(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	LogInfof("url: '%s'\n", uri)
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
	model := struct {
		UserHandle string
	}{}
	if dbUser != nil {
		model.UserHandle = dbUser.Handle.String
	}
	execTemplate(w, tmplIndex, model)
}

func getReferer(r *http.Request) string {
	return r.Header.Get("Referer")
}

func handleFavicon(w http.ResponseWriter, r *http.Request) {
	http.NotFound(w, r)
}

// /s/$rest
func handleStatic(w http.ResponseWriter, r *http.Request) {
	fileName := r.URL.Path[len("/s/"):]
	path := filepath.Join("s", fileName)
	if u.PathExists(path) {
		//logger.Noticef("serveFileFromDir(): %q", filePath)
		http.ServeFile(w, r, path)
	} else {
		fmt.Printf("handleS() file %q doesn't exist, referer: %q\n", fileName, getReferer(r))
		http.NotFound(w, r)
	}
}

// /u/{user_handle}
func handleUser(w http.ResponseWriter, r *http.Request) {
	userHandle := r.URL.Path[len("/u/"):]
	i, err := getCachedUserInfoByHandle(userHandle)
	if err != nil || i == nil {
		http.NotFound(w, r)
		return
	}
	LogInfof("%d notes for user '%s'\n", len(i.notes), userHandle)
	model := struct {
		ColorsCSS string
		User      *DbUser
		Notes     []*Note
	}{
		ColorsCSS: colorsCssString,
		User:      i.user,
		Notes:     i.notes,
	}
	execTemplate(w, tmplUser, model)
}

func getNodeByIDHash(w http.ResponseWriter, r *http.Request, noteIDHashStr string) *Note {
	noteID := dehashInt(noteIDHashStr)
	LogInfof("note id str: '%s'\n", noteIDHashStr)
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		return nil
	}
	if note.IsPublic {
		return note
	}
	dbUser := getUserFromCookie(w, r)
	if dbUser == nil || dbUser.ID != note.UserID {
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
		noteIDHashStr = noteIDHashStr[:idx-1]
	}

	note := getNodeByIDHash(w, r, noteIDHashStr)
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
	vals := r.URL.Query()
	noteIDHashStr := strings.TrimSpace(vals.Get("id"))
	if noteIDHashStr == "" {
		httpJSONError(w, "/api/getnote.json: missing 'id' attribute")
		return
	}

	note := getNodeByIDHash(w, r, noteIDHashStr)
	if note == nil {
		httpJSONError(w, "/api/getnote.json: invalid id attribute '%s'", noteIDHashStr)
		return
	}

	content, err := getCachedContent(note.ContentSha1)
	if err != nil {
		LogErrorf("getCachedContent() failed with %s\n", err)
		httpJSONError(w, "/api/getnote.json: getCachedContent() failed with %s", err)
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

// /api/getnotes.json?user=${user}&start=${start}&len=${len}
func handleAPIGetNotes(w http.ResponseWriter, r *http.Request) {
	dbUser := getUserFromCookie(w, r)
	userHandle := strings.TrimSpace(r.FormValue("user"))
	fmt.Printf("handleApiGetNotes userName: '%s'\n", userHandle)
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
		NotesUserHandle    string
		NotesCount         int
		Notes              []*Note
	}{
		LoggedInUserHandle: loggedInUserHandle,
		NotesUserHandle:    i.user.Handle.String,
		NotesCount:         len(notes),
		Notes:              notes,
	}
	httpOkWithJSON(w, v)
}

// POST /api/createorupdatenote
//  noteIdHash : if given, this is an update, if not, this is create new
//  format     : "text", "0", "markdown", "1"
//  content    : text of the note
//  ispublic   : "true", "1", "false", "0"
//  tags       : tag1,tag2,tag3, can be empty
func handleAPICreateNote(w http.ResponseWriter, r *http.Request) {
	// TODO: write me
	httpServerError(w, r)
}

func registerHTTPHandlers() {
	http.HandleFunc("/", handleIndex)
	http.HandleFunc("/favicon.ico", handleFavicon)
	http.HandleFunc("/s/", handleStatic)
	http.HandleFunc("/u/", handleUser)
	http.HandleFunc("/n/", handleNote)
	http.HandleFunc("/logintwitter", handleLoginTwitter)
	http.HandleFunc("/logintwittercb", handleOauthTwitterCallback)
	//http.HandleFunc("/logingithub", handleLoginGitHub)
	//http.HandleFunc("/logingoogle", handleLoginGoogle)
	http.HandleFunc("/logout", handleLogout)
	http.HandleFunc("/importsimplenote", handleImportSimpleNote)
	http.HandleFunc("/api/getnotes.json", handleAPIGetNotes)
	http.HandleFunc("/api/getnote.json", handleAPIGetNote)
	http.HandleFunc("/api/createnote", handleAPICreateNote)
}

func startWebServer() {
	registerHTTPHandlers()
	fmt.Printf("Started runing on %s\n", httpAddr)
	if err := http.ListenAndServe(httpAddr, nil); err != nil {
		fmt.Printf("http.ListendAndServer() failed with %s\n", err)
	}
	fmt.Printf("Exited\n")
}
