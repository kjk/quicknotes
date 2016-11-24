import { ajax, Params } from './ajax';
import { Dict } from './utils';
import { Note, toNote, toNotes } from './Note';
import { UserInfo } from './types';
import * as action from './action';

type ArgsDict = Dict<string>;

type WsCb = (err: Error, rsp: any) => void;

// TODO: audit for error handling
// TODO: reconnect ws https://github.com/voidabhi/es6-rws/blob/master/rws.js

let wsSock: WebSocket = null;

let wsCurrReqID = 0;

interface WsReqMsg {
  id: number;
  cmd: string;
  args: any;
}

interface WsReq {
  msg: WsReqMsg;
  cb: WsCb;
  convertResult?: (result: any) => any;
}

let requests: WsReq[] = [];

function wsPopReqForID(id: number): WsReq {
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    if (req.msg.id == id) {
      requests = requests.splice(i, 1);
      return req;
    }
  }
  return null;
}

function wsProcessRsp(rsp: any) {
  const req = wsPopReqForID(rsp.id);
  if (!req) {
    console.log('no request for response', rsp);
    return;
  }
  if (rsp.error) {
    console.log('error response', rsp, 'for request', req);
    const err = new Error(rsp.error);
    req.cb(err, null);
    return;
  }
  if (req.msg.cmd !== 'ping') {
    console.log('got response for request', req);
  }
  let result = rsp.result;
  if (req.convertResult) {
    result = req.convertResult(result);
  }
  req.cb(null, result);
  return;
}

function wsFailAllRequests() {
  for (const req of requests) {
    req.cb(new Error("connection failed"), null);
  }
  requests = [];
}

function wsNextReqID(): number {
  wsCurrReqID++;
  return wsCurrReqID;
}

let wsSockReady = false;

let bufferedRequests: WsReq[] = [];

let wsSockTimer: number = 0;

// how long to wait between reconnects
let reconnectIntervalMs = 1000;
const reconnectDecay = 1.5;
const maxReconnectIntervalMs = 30000;
// how long to wait before deciding a connection attempt timed out
const connectionTimeoutMs = 5000;
let reconnectAttempts = 0;

window.tryWsReconnect = (e: MouseEvent) => {
  console.log('tryWsReconnect');
  openWebSocket();
  return false;
}

function scheduleReconnect() {
  const timeoutMs = reconnectIntervalMs * Math.pow(reconnectDecay, reconnectAttempts);

  if (timeoutMs > maxReconnectIntervalMs) {
    action.showConnectionStatus('Disconnected from server. <a href="#" onclick="tryWsReconnect()">Reconnect</a>.');
    reconnectAttempts = 0;
    return;
  }

  reconnectAttempts++;
  console.log(`Scheduling ${reconnectAttempts} reconnect in ${timeoutMs} ms`);
  const reconnectTimeSec = (timeoutMs / 1000).toFixed(0);
  action.showConnectionStatus(`Disconnected from server. Reconnect attempt in ${reconnectTimeSec} sec.`);
  setTimeout(() => {
    openWebSocket();
  }, timeoutMs);
}

let wsConnTimeout: number = 0;

export function openWebSocket() {
  const host = window.location.host;
  action.showConnectionStatus('Connecting to the server...');

  wsSock = new WebSocket('ws://' + host + '/api/ws');
  wsSock.binaryType = "arraybuffer"; // also "blob", instanceof ArrayBuffer

  wsConnTimeout = setTimeout(() => {
    // onclose() can be called before timeout happens
    if (wsSock) {
      wsSock.close();
    }
  }, connectionTimeoutMs);

  wsSock.onopen = (ev) => {
    console.log('ws opened');
    action.showConnectionStatus(null);
    clearTimeout(wsConnTimeout);
    wsSockReady = true;
    for (const wsReq of bufferedRequests) {
      wsRealSendReq(wsReq);
    }
    bufferedRequests = []
    //action.showConnectionStatus('Connection status: connected.');
  };

  wsSock.onmessage = (ev) => {
    //console.log('ev:', ev, 'ev.data', ev.data);
    const rsp = JSON.parse(ev.data);
    wsProcessRsp(rsp);
  };

  wsSock.onclose = (ev) => {
    console.log('wsSock.onclose: ev', ev);
    wsSock = null;
    wsSockReady = false;
    if (wsSockTimer) {
      clearInterval(wsSockTimer);
      wsSockTimer = 0;
    }
    wsFailAllRequests();
    scheduleReconnect();
  }

  // onerror will be followed by onclose
  wsSock.onerror = (ev) => {
    console.log('wsSock.onerror: ev', ev);
  }

  // TOOD: it's the server that should send pings, but that's harder
  wsSockTimer = setInterval(() => {
    if (wsSock) {
      ping();
    }
  }, 50 * 1000);
}

function wsRealSendReq(wsReq: WsReq) {
  requests.push(wsReq);
  const msgJSON = JSON.stringify(wsReq.msg);
  wsSock.send(msgJSON);
  if (wsReq.msg.cmd !== 'ping') {
    console.log('sent ws req:', msgJSON);
  }
}

function wsSendReq(cmd: string, args: any, cb: WsCb, convertResult?: (result: any) => any): any {
  const msg: WsReqMsg = {
    id: wsNextReqID(),
    cmd,
    args,
  }

  const wsReq: WsReq = {
    msg,
    cb,
    convertResult,
  }

  if (wsSockReady) {
    wsRealSendReq(wsReq);
  } else {
    bufferedRequests.push(wsReq);
  }
}

function buildArgs(args?: ArgsDict): string {
  if (!args) {
    return null;
  }
  let parts: string[] = [];
  for (let key in args) {
    const val = args[key];
    const p = encodeURIComponent(key) + '=' + encodeURIComponent(val);
    parts.push(p);
  }
  return parts.join('&');
}

function handleResponse(code: number, respTxt: string, cb: any, cbErr: any) {
  if (!cb) {
    return;
  }
  let js: any = {};
  if (code == 200) {
    respTxt = respTxt || '{}';
    js = JSON.parse(respTxt);
  } else {
    respTxt = respTxt || '';
    console.log(`handleResponse: code = ${code}, respTxt = '${respTxt}'`);
    js['Error'] = `request returned code ${code}, text: '${respTxt}'`;
  }
  const errMsg = js['Error'];
  if (errMsg) {
    if (cbErr) {
      cbErr(js);
    } else {
      alert(errMsg);
    }
  } else {
    cb(js);
  }
}

function get(url: string, args: ArgsDict, cb: any, cbErr?: any) {
  const urlArgs = buildArgs(args);
  if (urlArgs) {
    url += '?' + urlArgs;
  }
  const params = {
    url: url
  };
  ajax(params, function(code, respTxt) {
    handleResponse(code, respTxt, cb, cbErr);
  });
}

function post(url: string, args: ArgsDict, cb: any, cbErr: any) {
  const params: any = {
    method: 'POST',
    url: url
  };
  const urlArgs = buildArgs(args);
  if (urlArgs) {
    params['body'] = urlArgs;
  }
  ajax(params, function(code, respTxt) {
    handleResponse(code, respTxt, cb, cbErr);
  });
}

interface GetNotesResp {
  LoggedUser?: any;
  Notes?: any[];
}

interface GetNotesCallback {
  (note: Note[]): void
}

function ping() {
  function pingCb(err: Error, result: any) {
    if (err) {
      console.log("ping response error:", err);
    } else {
      //console.log("ping response:", result);
    }
  }
  wsSendReq('ping', {}, pingCb);
}

function getUserInfoConvertResult(result: any) {
  return result.UserInfo;
}

export function getUserInfo(userIDHash: string, cb: WsCb) {
  const args: any = {
    userIDHash,
  };
  wsSendReq('getUserInfo', args, cb, getUserInfoConvertResult);
}

function getNotesConvertResult(result: GetNotesResp) {
  if (!result || !result.Notes) {
    return [];
  }
  return toNotes(result.Notes);
}

// calls cb with Note[]
export function getNotes(userIDHash: string, cb: WsCb) {
  const args: any = {
    userIDHash,
  };
  wsSendReq('getNotes', args, cb, getNotesConvertResult);
}

// calls cb with Note[]
export function getRecentNotes(cb: WsCb) {
  wsSendReq('getRecentNotes', {}, cb, getNotesConvertResult);
}

function getNoteConvertResult(note: any) {
  return toNote(note);
}

// calls cb with Note
export function getNote(noteHashID: string, cb: WsCb) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('getNote', args, cb, getNoteConvertResult);
}

export function undeleteNote(noteHashID: string, cb: WsCb) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('undeleteNote', args, cb, null);
}

export function deleteNote(noteHashID: string, cb: WsCb) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('deleteNote', args, cb, null);
}

export function permanentDeleteNote(noteHashID: string, cb: WsCb) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('permanentDeleteNote', args, cb, null);
}

export function makeNotePrivate(noteHashID: string, cb: WsCb) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('makeNotePrivate', args, cb);
}

export function makeNotePublic(noteHashID: string, cb: WsCb) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('makeNotePublic', args, cb, null);
}

export function starNote(noteHashID: string, cb: WsCb) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('starNote', args, cb, null);
}

export function unstarNote(noteHashID: string, cb: WsCb) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('unstarNote', args, cb, null);
}

export function createOrUpdateNote(noteJSON: string, cb: WsCb) {
  const args: any = {
    noteJSON,
  };
  wsSendReq('createOrUpdateNote', args, cb, null);
}

export function searchUserNotes(userIDHash: string, searchTerm: string, cb: WsCb) {
  const args: any = {
    userIDHash,
    searchTerm
  };
  wsSendReq('searchUserNotes', args, cb, null);
}

export function importSimpleNoteStart(email: string, password: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    email,
    password,
  };
  get('/api/import_simplenote_start', args, cb, cbErr);
}

export function importSimpleNoteStatus(importId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'id': importId
  };
  get('/api/import_simplenote_status', args, cb, cbErr);
}
