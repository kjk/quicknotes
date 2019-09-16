package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kjk/quicknotes/pkg/log"
)

const (
	writeTimeout = 30 * time.Second
	readTimeout  = time.Minute
	cmdPing      = "ping"
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

var (
	muWsConnections sync.Mutex
	wsConnections   map[int][]chan *wsResponse
)

func wsRememberConnection(userID int, c chan *wsResponse) {
	muWsConnections.Lock()
	defer muWsConnections.Unlock()
	if wsConnections == nil {
		wsConnections = make(map[int][]chan *wsResponse)
	}
	a := wsConnections[userID]
	a = append(a, c)
	wsConnections[userID] = a
}

func wsRemoveConnection(userID int, cToRemove chan *wsResponse) {
	muWsConnections.Lock()
	defer muWsConnections.Unlock()
	a := wsConnections[userID]
	for i, c := range a {
		if c == cToRemove {
			a[i], a = a[len(a)-1], a[:len(a)-1]
			break
		}
	}
	if len(a) == 0 {
		delete(wsConnections, userID)
	} else {
		wsConnections[userID] = a
	}
}

func wsBroadcastToUser(userID int, v *wsResponse) {
	muWsConnections.Lock()
	defer muWsConnections.Unlock()
	arr := wsConnections[userID]
	for _, c := range arr {
		c <- v
	}
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

func jsonMapGetInt(m map[string]interface{}, key string) (int, error) {
	v, ok := m[key]
	if !ok {
		return 0, fmt.Errorf("no '%s' in %v", key, m)
	}
	f, ok := v.(float64)
	if ok {
		return int(f), nil
	}
	s, ok := v.(string)
	if !ok {
		return 0, fmt.Errorf("key '%s' is not of type string or float64. Type: %T, value: '%v'", key, v, v)
	}
	return strconv.Atoi(s)
}

func getNoteCompact(ctx *ReqContext, noteID int) ([]interface{}, error) {
	note, err := getNoteByID(ctx, noteID)
	if err != nil {
		return nil, err
	}
	return noteToCompact(note, true)
}

func getUserNoteByHashID(ctx *ReqContext, noteID string) (string, error) {
	log.Verbosef("note id: %d\n", noteID)
	note, err := dbGetNoteByID(noteID)
	if err != nil {
		return "", err
	}
	if note.userID != ctx.User.id {
		err = fmt.Errorf("note '%s' doesn't belong to user %d ('%s')", noteID, ctx.User.id, ctx.User.Handle)
		return "", err
	}
	return noteID, nil
}

type getUserInfoRsp struct {
	UserInfo *UserSummary
}

func wsGetUserInfo(args map[string]interface{}) (*getUserInfoRsp, error) {
	userID, err := jsonMapGetString(args, "userIDHash")
	if err != nil {
		return nil, fmt.Errorf("'userIDHash' argument missing in '%v'", args)
	}

	i, err := getCachedUserInfo(userID)
	if err != nil || i == nil {
		return nil, fmt.Errorf("no user '%d', err: '%s'", userID, err)
	}
	userInfo := userSummaryFromDbUser(i.user)
	return &getUserInfoRsp{userInfo}, nil
}

func wsGetRecentNotes(limit int) (interface{}, error) {
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
	res := struct {
		Notes [][]interface{}
	}{
		Notes: notes,
	}
	return &res, nil
}

func getNotesForUser(ctx *ReqContext, userID string, latestVersion int) (interface{}, error) {
	i, err := getCachedUserInfo(userID)
	if err != nil || i == nil {
		return nil, fmt.Errorf("getCachedUserInfo('%d') failed with '%s'", userID, err)
	}

	showPrivate := ctx.User != nil && userID == ctx.User.id
	var notes [][]interface{}
	for _, note := range i.notes {
		if note.IsPublic || showPrivate {
			compactNote, _ := noteToCompact(note, false)
			notes = append(notes, compactNote)
		}
	}

	loggedUserID := ""
	loggedUserHandle := ""
	if ctx.User != nil {
		loggedUserHandle = ctx.User.Handle
		loggedUserID = ctx.User.id
	}
	log.Verbosef("%d notes of user '%d' ('%s'), logged in user: %d ('%s'), showPrivate: %v\n", len(notes), userID, i.user.Login, loggedUserID, loggedUserHandle, showPrivate)

	// optimization: if our latest version is the same as the
	// version on the client, we don't return notes
	if latestVersion == i.latestVersion {
		notes = nil
	}

	v := struct {
		LoggedUser    *UserSummary
		Notes         [][]interface{}
		LatestVersion int
	}{
		LoggedUser:    ctx.User,
		Notes:         notes,
		LatestVersion: i.latestVersion,
	}
	return v, nil
}

func wsGetNotes(ctx *ReqContext, args map[string]interface{}) (interface{}, error) {
	userIDHash, err := jsonMapGetString(args, "userIDHash")
	if err != nil {
		return nil, err
	}
	userID, err := dehashInt(userIDHash)
	if err != nil {
		return nil, fmt.Errorf("invalid userIDHash='%s'", userIDHash)
	}
	latestVersion, err := jsonMapGetInt(args, "latestVersion")
	if err != nil {
		return nil, err
	}

	return getNotesForUser(ctx, userID, latestVersion)
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

	//log.Verbosef("wsCreateOrUpdateNote: noteJSONStr: %s\n", noteJSONStr)
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

var upgrader = websocket.Upgrader{
	ReadBufferSize:  8 * 1024,
	WriteBufferSize: 8 * 1024,
}

func handleWs(w http.ResponseWriter, r *http.Request) {
	user := getUserSummaryFromCookie(w, r)
	userID := -1
	if user != nil {
		userID = user.id
	}
	log.Infof("user: %d\n", userID)
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error(err)
		return
	}

	c := make(chan *wsResponse)
	if user != nil {
		wsRememberConnection(user.id, c)
	}

	var writeError error
	var muWriteError sync.Mutex

	getWriteError := func() error {
		muWriteError.Lock()
		defer muWriteError.Unlock()
		return writeError
	}

	go func() {
		for rsp := range c {
			if rsp.Cmd != cmdPing {
				log.Infof("writing a response for cmd: %s id: %d, user: %d\n", rsp.Cmd, rsp.ID, userID)
			}
			conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			err := conn.WriteJSON(rsp)
			if err != nil {
				log.Errorf("conn.WriteJSON('%s') for user %d failed with '%s'\n", rsp.Cmd, userID, err)
				muWriteError.Lock()
				writeError = err
				muWriteError.Unlock()
			}
		}
	}()

	for {
		ctx := ReqContext{
			User: user,
		}
		// we rely on the client send us periodic pings so we don't
		// want to wait forever for the next message
		conn.SetReadDeadline(time.Now().Add(readTimeout))
		typ, reqBytes, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Errorf("error: %v", err)
			} else {
				log.Infof("closing websocket, msg type: '%d', err: '%s', req: '%s'\n", typ, err, string(reqBytes))
			}
			break
		}
		var req wsGenericReq
		err = json.Unmarshal(reqBytes, &req)
		if err != nil {
			log.Errorf("failed to decode request as json, req: '%s'\n", string(reqBytes))
			continue
		}

		if req.Cmd != cmdPing {
			if req.Cmd == "createOrUpdateNote" {
				// too much data to fully log
				log.Verbosef("msg: '%s'\n", req.Cmd)
			} else {
				log.Verbosef("msg: '%s'\n", string(reqBytes))
			}
		}

		var res interface{}
		args := req.Args

		broadcastGetNotes := false

		switch req.Cmd {
		case cmdPing:
			res = "pong"

		case "getUserInfo":
			res, err = wsGetUserInfo(args)

		case "getNotes":
			res, err = wsGetNotes(&ctx, args)

		case "getRecentNotes":
			res, err = wsGetRecentNotes(25)

		case "getNote":
			res, err = wsGetNote(&ctx, args)

		case "permanentDeleteNote":
			res, err = wsPermanentDeleteNote(&ctx, args)
			broadcastGetNotes = true

		case "undeleteNote":
			res, err = execNoteOp(&ctx, args, dbUndeleteNote)
			broadcastGetNotes = true

		case "deleteNote":
			res, err = execNoteOp(&ctx, args, dbDeleteNote)
			broadcastGetNotes = true

		case "makeNotePrivate":
			res, err = execNoteOp(&ctx, args, dbMakeNotePrivate)
			broadcastGetNotes = true

		case "makeNotePublic":
			res, err = execNoteOp(&ctx, args, dbMakeNotePublic)
			broadcastGetNotes = true

		case "starNote":
			res, err = execNoteOp(&ctx, args, dbStarNote)
			broadcastGetNotes = true

		case "unstarNote":
			res, err = execNoteOp(&ctx, args, dbUnstarNote)
			broadcastGetNotes = true

		case "createOrUpdateNote":
			res, err = wsCreateOrUpdateNote(&ctx, args)
			broadcastGetNotes = true

		case "searchUserNotes":
			res, err = wsSearchUserNotes(&ctx, args)

		default:
			log.Errorf("unknown type '%s' in request '%s'\n", req.Cmd, string(reqBytes))
			continue
		}

		rsp := wsResponse{
			ID:     req.ID,
			Cmd:    req.Cmd,
			Result: res,
		}

		if err != nil {
			rsp.Err = err.Error()
			rsp.Result = nil
			log.Errorf("handling request '%s' failed with '%s'\n", string(reqBytes), err)
		}

		c <- &rsp

		if broadcastGetNotes {
			log.Infof("broadcastGetNotes because handled '%s'\n", req.Cmd)
			res, err = getNotesForUser(&ctx, ctx.User.id, 0)
			rsp := wsResponse{
				ID:     -1,
				Cmd:    "broadcastUserNotes",
				Result: res,
			}

			if err != nil {
				rsp.Err = err.Error()
				rsp.Result = nil
				log.Errorf("handling request '%s' failed with '%s'\n", string(reqBytes), err)
			}

			wsBroadcastToUser(ctx.User.id, &rsp)
		}
		err = getWriteError()
		if err != nil {
			break
		}
	}

	log.Infof("closed connection for user %d\n", userID)
	conn.Close()
	wsRemoveConnection(userID, c)
}
