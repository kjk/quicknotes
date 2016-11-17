package main

import (
	"encoding/json"
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
			userHashID, err := jsonMapGetString(args, "userHashID")
			if err == nil {
				res, err = apiGetUserInfo(userHashID)
			}
		case "getNote":
			noteHashID, err := jsonMapGetString(args, "noteHashID")
			if err == nil {
				res, err = apiGetNote(&ctx, noteHashID)
			}
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
