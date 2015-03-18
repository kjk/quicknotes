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

// /n/{note_id}
func handleNote(w http.ResponseWriter, r *http.Request) {
	noteIDStr := r.URL.Path[len("/n/"):]
	LogInfof("note id: '%s' NYI\n", noteIDStr)
	/*noteID, err := strconv.Atoi(noteIDStr)
	if err != nil {
		http.NotFound(w, r)
		return
	}*/

	http.NotFound(w, r)
}

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

func findNoteByID(notes []*Note, id int) *Note {
	for _, n := range notes {
		if n.ID == id {
			return n
		}
	}
	return nil
}

func httpServerError(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "internal server error", http.StatusInternalServerError)
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
		// TODO: this is not safe, need to make a copy
		note.SetCalculatedProperties()
		if onlyPublic {
			if note.IsPublic {
				notes = append(notes, note)
			}
		} else {
			notes = append(notes, note)
		}
	}

	LogInfof("%d notes of user '%s', logged in user: '%s', onlyPublic: %v\n", len(notes), userHandle, loggedInUserHandle, onlyPublic)
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

// /api/getnote.json?id={noteId}
func handleAPIGetNote(w http.ResponseWriter, r *http.Request) {
	vals := r.URL.Query()
	noteIDStr := strings.TrimSpace(vals.Get("id"))
	if noteIDStr == "" {
		httpJSONError(w, "/api/getnote.json: missing 'id' attribute")
		return
	}
	noteID, err := strconv.Atoi(noteIDStr)
	if err != nil {
		httpJSONError(w, "/api/getnote.json: invalid id attribute '%s'", noteIDStr)
		return
	}
	// TODO: get user from the cookie
	userHandle := "kjk"
	userInfo, err := getCachedUserInfoByHandle(userHandle)
	if err != nil {
		LogErrorf("getCachedUserInfoByName('%s') failed with %s\n", userHandle, err)
		httpJSONError(w, "/api/getnote.json: getCachedUserInfoByName('%s') failed with'%s'", userHandle, err)
		return
	}

	note := findNoteByID(userInfo.notes, noteID)
	if note == nil {
		LogErrorf("findNoteById('%d') didn't find a note\n", noteID)
		httpJSONError(w, "/api/getnote.json: findNoteById('%d') didn't find a note", noteID)
		return
	}
	content, err := getCachedContent(note.ContentSha1)
	if err != nil {
		LogErrorf("getCachedContent() failed with %s\n", err)
		httpJSONError(w, "/api/getnote.json: getCachedContent() failed with %s", err)
		return
	}
	v := struct {
		ID      int
		Title   string
		ColorID int
		Format  int
		Content string
		Tags    []string
	}{
		ID:      note.ID,
		Title:   note.Title,
		ColorID: note.ColorID,
		Format:  note.Format,
		Content: string(content),
		Tags:    note.Tags,
	}
	httpOkWithJSON(w, v)
}

func handleAPIUserName(w http.ResponseWriter, r *http.Request) {
	LogInfof("handleApiUserName()\n")
	v := struct {
		UserName string
	}{
		UserName: "kjk",
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
	//http.HandleFunc("/logingithub", handleLoginGitHub)
	//http.HandleFunc("/logingoogle", handleLoginGoogle)
	http.HandleFunc("/logout", handleLogout)
	http.HandleFunc("/importsimplenote", handleImportSimpleNote)
	http.HandleFunc("/api/getnotes.json", handleAPIGetNotes)
	http.HandleFunc("/api/getnote.json", handleAPIGetNote)
	http.HandleFunc("/api/username.json", handleAPIUserName)
}

func startWebServer() {
	registerHTTPHandlers()
	fmt.Printf("Started runing on %s\n", httpAddr)
	if err := http.ListenAndServe(httpAddr, nil); err != nil {
		fmt.Printf("http.ListendAndServer() failed with %s\n", err)
	}
	fmt.Printf("Exited\n")
}
