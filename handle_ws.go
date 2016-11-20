package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kjk/log"
)

// NewNoteFromBrowser represents format of the note sent by the browser
type NewNoteFromBrowser struct {
	HashID   string
	Title    string
	Format   string
	Content  string
	Tags     []string
	IsPublic bool
}

type wsGenericReq struct {
	ID   int                    `json:"id"`
	Cmd  string                 `json:"cmd"`
	Args map[string]interface{} `json:"args"`
}

type wsResponse struct {
	ID     int         `json:"id"`
	Cmd    string      `json:"cmd"`
	Result interface{} `json:"result"`
	Err    string      `json:"error,omitempty"`
}

func jsonMapGetString(m map[string]interface{}, key string) (string, error) {
	v, ok := m[key]
	if !ok {
		return "", fmt.Errorf("no '%s' in %v", key, m)
	}
	s, ok := v.(string)
	if !ok {
		return "", fmt.Errorf("'%s' is not of type string. Type: %T, value: '%v'", key, v, v)
	}
	return s, nil
}

func getNoteCompact(ctx *ReqContext, noteID int) ([]interface{}, error) {
	note, err := getNoteByID(ctx, noteID)
	if err != nil {
		return nil, err
	}
	return noteToCompact(note, true)
}

func getUserNoteByHashID(ctx *ReqContext, noteHashIDStr string) (int, error) {
	noteID, err := dehashInt(noteHashIDStr)
	if err != nil {
		return -1, err
	}
	log.Verbosef("note id hash: '%s', id: %d\n", noteHashIDStr, noteID)
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		return -1, err
	}
	if note.userID != ctx.User.id {
		err = fmt.Errorf("note '%s' doesn't belong to user %d ('%s')\n", noteHashIDStr, ctx.User.id, ctx.User.Handle)
		return -1, err
	}
	return noteID, nil
}

type getUserInfoRsp struct {
	UserInfo *UserSummary
}

func wsGetUserInfo(args map[string]interface{}) (*getUserInfoRsp, error) {
	userIDHash, err := jsonMapGetString(args, "userIDHash")
	if err != nil {
		return nil, fmt.Errorf("'userIDHash' argument missing in '%v'", args)
	}

	userID, err := dehashInt(userIDHash)
	if err != nil {
		return nil, fmt.Errorf("invalid userID: '%s'", userIDHash)
	}
	i, err := getCachedUserInfo(userID)
	if err != nil || i == nil {
		return nil, fmt.Errorf("no user '%d', err: '%s'", userID, err)
	}
	userInfo := userSummaryFromDbUser(i.user)
	return &getUserInfoRsp{userInfo}, nil
}

func wsGetRecentNotes(limit int) ([][]interface{}, error) {
	if limit > 300 {
		limit = 300
	}
	recentNotes, err := getRecentPublicNotesCached(limit)
	if err != nil {
		return nil, fmt.Errorf("getRecentPublicNotesCached() failed with '%s'", err)
	}
	var notes [][]interface{}
	for _, note := range recentNotes {
		compactNote, _ := noteToCompact(&note, false)
		notes = append(notes, compactNote)
	}
	return notes, nil
}

func wsGetNotes(ctx *ReqContext, args map[string]interface{}) (interface{}, error) {
	userIDHash, err := jsonMapGetString(args, "userIDHash")
	if err != nil {
		return nil, err
	}
	v := struct {
		LoggedUser *UserSummary
		Notes      [][]interface{}
	}{
		LoggedUser: ctx.User,
	}
	userID, err := dehashInt(userIDHash)
	if err != nil {
		return nil, fmt.Errorf("invalid userIDHash='%s'\n", userIDHash)
	}
	i, err := getCachedUserInfo(userID)
	if err != nil || i == nil {
		return nil, fmt.Errorf("getCachedUserInfo('%d') failed with '%s'\n", userID, err)
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
	v.Notes = notes
	return v, err
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

func getNoteByIDHash(ctx *ReqContext, noteHashIDStr string) (*Note, error) {
	noteHashIDStr = strings.TrimSpace(noteHashIDStr)
	noteID, err := dehashInt(noteHashIDStr)
	if err != nil {
		return nil, err
	}
	// log.Verbosef("note id hash: '%s', id: %d\n", noteHashIDStr, noteID)
	return getNoteByID(ctx, noteID)
}

func wsGetNote(ctx *ReqContext, args map[string]interface{}) ([]interface{}, error) {
	noteHashIDStr, err := jsonMapGetString(args, "noteHashID")
	if err != nil {
		return nil, fmt.Errorf("'noteHashID' argument missingin '%v'", args)
	}

	note, err := getNoteByIDHash(ctx, noteHashIDStr)
	if err != nil || note == nil {
		return nil, fmt.Errorf("no note with noteHashID '%s'", noteHashIDStr)
	}

	if !userCanAccessNote(ctx.User, note) {
		return nil, fmt.Errorf("access of user '%s' denied for note '%s'", ctx.User.HashID, noteHashIDStr)
	}
	return noteToCompact(note, true)
}

func execNoteOp(ctx *ReqContext, args map[string]interface{}, noteOp func(int, int) error) ([]interface{}, error) {
	var err error
	noteHashID, err := jsonMapGetString(args, "noteHashID")
	if err != nil {
		return nil, err
	}
	noteID, err := getUserNoteByHashID(ctx, noteHashID)
	if err != nil {
		return nil, err
	}
	err = noteOp(ctx.User.id, noteID)
	if err != nil {
		return nil, err
	}
	return getNoteCompact(ctx, noteID)
}

func wsPermanentDeleteNote(ctx *ReqContext, args map[string]interface{}) (interface{}, error) {
	noteHashID, err := jsonMapGetString(args, "noteHashID")
	if err != nil {
		return nil, err
	}
	noteID, err := getUserNoteByHashID(ctx, noteHashID)
	if err != nil {
		return nil, err
	}
	err = dbPermanentDeleteNote(ctx.User.id, noteID)
	if err != nil {
		return nil, err
	}
	res := struct {
		Msg string
	}{
		Msg: "note has been permanently deleted",
	}
	return res, nil
}

func newNoteFromBrowserNote(note *NewNoteFromBrowser) (*NewNote, error) {
	var newNote NewNote
	//log.Verbosef("note: %s\n", noteJSON)
	if !isValidFormat(note.Format) {
		return nil, fmt.Errorf("invalid format %s", note.Format)
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
	return &newNote, nil
}

func wsCreateOrUpdateNote(ctx *ReqContext, args map[string]interface{}) (interface{}, error) {
	noteJSONStr, err := jsonMapGetString(args, "noteJSON")
	if err != nil {
		return nil, err
	}
	var noteFromBrowser NewNoteFromBrowser
	err = json.Unmarshal([]byte(noteJSONStr), &noteFromBrowser)
	if err != nil {
		return nil, fmt.Errorf("wsCreateOrUpdateNote: failed to decode '%s'", noteJSONStr)
	}

	note, err := newNoteFromBrowserNote(&noteFromBrowser)
	if err != nil {
		return nil, err
	}

	noteID, err := dbCreateOrUpdateNote(ctx.User.id, note)
	if err != nil {
		return nil, fmt.Errorf("dbCreateNewNote() failed with %s", err)
	}
	v := struct {
		HashID string
	}{
		HashID: hashInt(noteID),
	}
	return &v, nil
}

func wsSearchUserNotes(ctx *ReqContext, args map[string]interface{}) (interface{}, error) {
	userIDHash, _ := jsonMapGetString(args, "userIDHash")
	searchTerm, _ := jsonMapGetString(args, "searchTerm")
	return apiSearchUserNotes(ctx, userIDHash, searchTerm)
}

func handleWs(w http.ResponseWriter, r *http.Request) {
	user := getUserSummaryFromCookie(w, r)
	log.Infof("user: %v\n", user)
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error(err)
		return
	}
	defer conn.Close()
	conn.SetReadLimit(1024)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error { conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		ctx := ReqContext{
			User: user,
		}
		_, req, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Errorf("error: %v", err)
			}
			break
		}
		log.Infof("msg: '%s'\n", string(req))
		var wsReq wsGenericReq
		err = json.Unmarshal(req, &wsReq)
		if err != nil {
			log.Errorf("failed to decode request as json, req: '%s'\n", string(req))
			continue
		}

		args := wsReq.Args
		var res interface{}

		switch wsReq.Cmd {
		case "getUserInfo":
			res, err = wsGetUserInfo(args)

		case "getNotes":
			res, err = wsGetNotes(&ctx, args)

		case "getRecentNotes":
			v := struct {
				Notes [][]interface{}
			}{}
			v.Notes, err = wsGetRecentNotes(25)

		case "getNote":
			res, err = wsGetNote(&ctx, args)

		case "permanentDeleteNote":
			res, err = wsPermanentDeleteNote(&ctx, args)

		case "undeleteNote":
			res, err = execNoteOp(&ctx, args, dbUndeleteNote)

		case "deleteNote":
			res, err = execNoteOp(&ctx, args, dbDeleteNote)

		case "makeNotePrivate":
			res, err = execNoteOp(&ctx, args, dbMakeNotePrivate)

		case "makeNotePublic":
			res, err = execNoteOp(&ctx, args, dbMakeNotePublic)

		case "starNote":
			res, err = execNoteOp(&ctx, args, dbStarNote)

		case "unstarNote":
			res, err = execNoteOp(&ctx, args, dbUnstarNote)

		case "createOrUpdateNote":
			res, err = wsCreateOrUpdateNote(&ctx, args)

		case "searchUserNotes":
			res, err = wsSearchUserNotes(&ctx, args)

		default:
			log.Errorf("unknown type '%s' in request '%s'\n", wsReq.Cmd, string(req))
			continue
		}

		wsRsp := wsResponse{
			ID:     wsReq.ID,
			Cmd:    wsReq.Cmd,
			Result: res,
		}

		if err != nil {
			wsRsp.Err = err.Error()
			log.Errorf("handling request '%s' failed with '%s'\n", string(req), err)
		}

		err = conn.WriteJSON(wsRsp)
		if err != nil {
			log.Errorf("conn.WriteJSON('%v') failed with '%s'\n", wsRsp, err)
		}
	}
}
