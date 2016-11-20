import { ajax, Params } from './ajax';
import { Dict } from './utils';
import { Note, toNote, toNotes } from './Note';
import { UserInfo } from './types';

type ArgsDict = Dict<string>;
type WsCb = (rsp: any) => void;

// TODO: audit for error handling
// TODO: reconnect ws https://github.com/voidabhi/es6-rws/blob/master/rws.js

let wsSock: WebSocket = null;

let wsCurrReqID = 0;
let requests: WsReq[] = [];

interface WsReqMsg {
  id: number;
  cmd: string;
  args: any;
}

interface WsReq {
  msg: WsReqMsg;
  cb: WsCb;
}

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
    return;
  }
  console.log('got response for request', req);
  req.cb(rsp.result);
}

function wsNextReqID(): number {
  wsCurrReqID++;
  return wsCurrReqID;
}

let wsSockReady = false;

let bufferedRequests: WsReq[] = [];

export function openWebSocket() {
  const host = window.location.host;
  wsSock = new WebSocket('ws://' + host + '/api/ws');
  wsSock.binaryType = "arraybuffer"; // also "blob", instanceof ArrayBuffer

  wsSock.onopen = (ev) => {
    console.log('ws opened');
    wsSockReady = true;
    for (const wsReq of bufferedRequests) {
      wsRealSendReq(wsReq);
    }
    bufferedRequests = []
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
  }

  wsSock.onerror = (ev) => {
    console.log('wsSock.onerror: ev', ev);
    wsSock = null;
    wsSockReady = false;
  }
}

function wsRealSendReq(wsReq: WsReq) {
  requests.push(wsReq);
  const msgJSON = JSON.stringify(wsReq.msg);
  wsSock.send(msgJSON);
  console.log('sent ws req:', msgJSON);
}

function wsSendReq(cmd: string, args: any, cb: (rsp: any) => void): any {
  const msg: WsReqMsg = {
    id: wsNextReqID(),
    cmd: cmd,
    args: args,
  }
  const wsReq: WsReq = {
    msg: msg,
    cb: cb,
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
    console.log(`handleResponse: code=${code}, respTxt='${respTxt}'`);
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

export interface GetNotesCallback {
  (note: Note[]): void
}

export function getUserInfo(userIDHash: string, cb: WsCb) {
  const args: any = {
    userIDHash,
  };
  function getUserInfoCb(result: any) {
    cb(result.UserInfo);
  }
  wsSendReq('getUserInfo', args, getUserInfoCb);
}

// calls cb with Note[]
export function getNotes(userIDHash: string, cb: WsCb) {
  const args: any = {
    userIDHash,
  };
  function getNotesCb(result: GetNotesResp) {
    if (!result || !result.Notes) {
      cb([]);
    }
    let notes = toNotes(result.Notes);
    cb(notes);
  }
  wsSendReq('getNotes', args, getNotesCb);
}

// calls cb with Note[]
export function getRecentNotes(cb: WsCb) {
  function getNotesCb(result: GetNotesResp) {
    if (!result || !result.Notes) {
      cb([]);
    }
    let notes = toNotes(result.Notes);
    cb(notes);
  }
  wsSendReq('getRecentNotes', {}, getNotesCb);
}

// calls cb with Note
export function getNote(noteHashID: string, cb: WsCb, cbErr?: any) {
  const args: any = {
    noteHashID,
  };
  function getNoteCb(note: any) {
    note = toNote(note);
    cb(note);
  }
  wsSendReq('getNote', args, getNoteCb);
}

export function undeleteNote(noteHashID: string, cb: WsCb, cbErr?: any) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('undeleteNote', args, cb, );
}

export function deleteNote(noteHashID: string, cb: WsCb, cbErr?: any) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('deleteNote', args, cb);
}

export function permanentDeleteNote(noteHashID: string, cb: WsCb, cbErr?: any) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('permanentDeleteNote', args, cb);
}

export function makeNotePrivate(noteHashID: string, cb: WsCb, cbErr?: any) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('makeNotePrivate', args, cb);
}

export function makeNotePublic(noteHashID: string, cb: WsCb, cbErr?: any) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('makeNotePublic', args, cb);
}

export function starNote(noteHashID: string, cb: WsCb, cbErr?: any) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('starNote', args, cb);
}

export function unstarNote(noteHashID: string, cb: any, cbErr?: any) {
  const args: any = {
    noteHashID,
  };
  wsSendReq('unstarNote', args, cb);
}

export function createOrUpdateNote(noteJSON: string, cb: any, cbErr?: any) {
  const args: any = {
    noteJSON,
  };
  wsSendReq('createOrUpdateNote', args, cb);
}

export function searchUserNotes(userIDHash: string, searchTerm: string, cb: any, cbErr?: any) {
  const args: any = {
    userIDHash,
    searchTerm
  };
  wsSendReq('searchUserNotes', args, cb);
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

