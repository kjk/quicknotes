package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kjk/log"
)

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
	v.Notes, err = apiGetNotes(ctx, userIDHash)
	return v, err
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

func wsCreateOrUpdateNote(ctx *ReqContext, args map[string]interface{}) (interface{}, error) {
	return nil, errors.New("NYI")
}

func wsSearchUserNotes(ctx *ReqContext, args map[string]interface{}) (interface{}, error) {
	userIDHash, _ := jsonMapGetString(args, "userIDHash")
	searchTerm, _ := jsonMapGetString(args, "searchTerm")
	return apiSearchUserNotes(ctx, userIDHash, searchTerm)
}

func handleWs(w http.ResponseWriter, r *http.Request) {
	user := getUserSummaryFromCookie(w, r)
	log.Infof("handleWs, user: %v\n", user)
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
		log.Infof("ws message: '%s'\n", string(req))
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
			userIDHash, err := jsonMapGetString(args, "userIDHash")
			if err == nil {
				res, err = apiGetUserInfo(userIDHash)
			}

		case "getNotes":
			res, err = wsGetNotes(&ctx, args)

		case "getRecentNotes":
			v := struct {
				Notes [][]interface{}
			}{}
			v.Notes, err = apiGetRecentNotes(25)

		case "getNote":
			noteHashID, err := jsonMapGetString(args, "noteHashID")
			if err == nil {
				res, err = apiGetNote(&ctx, noteHashID)
			}

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
