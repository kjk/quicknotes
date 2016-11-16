import { ajax, Params } from './ajax';
import { Dict } from './utils';
import { Note, toNote, toNotes } from './Note';

type ArgsDict = Dict<string>;
type WsCb = (rsp: any) => void;

// TODO: audit for error handling

let wsSock: WebSocket = null;

let wsCurrReqID = 0;
let requests: WsReq[] = [];

class WsReq {
  req: any;
  rspCb: WsCb;

  constructor(req: any, rspCb: WsCb) {
    this.req = req;
    this.rspCb = rspCb;
  }
}

function wsPopReqForID(id: number): WsReq {
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    if (req.req.id == id) {
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
  if (rsp.Error) {
    console.log('error response', rsp, 'for request', req);
    return;
  }
  console.log('got response for request', req);
  req.rspCb(rsp);
}

function wsNextReqID(): number {
  wsCurrReqID++;
  return wsCurrReqID;
}

export function openWebSocket() {
  const host = window.location.hostname;
  wsSock = new WebSocket('ws://' + host + '/api/ws');
  //wsSock.binaryType = 'typedarray';

  wsSock.onopen = (ev) => {
    console.log('ws opened');
  };

  wsSock.onmessage = (ev) => {
    console.log('ev:', ev, 'ev.data', ev.data);
    wsProcessRsp(ev.data);
  };

  wsSock.onerror = (ev) => {
    console.log('wsSock.onerror: ev', ev);
    wsSock = null;
  }
}

function wsSendReq(typ: string, args: any, cb: (rsp: any) => void): any {
  let req = {
    id: wsNextReqID(),
    type: typ,
  }
  req = Object.assign(req, args);
  const wsReq = new WsReq(req, cb);
  requests.push(wsReq);
  const reqJSON = JSON.stringify(req);
  wsSock.send(reqJSON);
  console.log('sent ws req:', req);
}

export function getUserInfo2(userHashID: string, cb: WsCb) {
  const args: any = {
    userHashID,
  };
  wsSendReq('getUserInfo', args, cb);
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

interface GetNotesCallback {
  (note: Note[]): void
}

// calls cb with Note[]
export function getNotes(userHandle: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'user': userHandle
  };
  function getNotesCb(json: GetNotesResp) {
    if (!json || !json.Notes) {
      cb([]);
    }
    let notes = toNotes(json.Notes);
    cb(notes);
  }
  get('/api/getnotes', args, getNotesCb, cbErr);
}

// calls cb with Note[]
export function getRecentNotes(cb: any, cbErr?: any) {
  function getNotesCb(json: GetNotesResp) {
    if (!json || !json.Notes) {
      cb([]);
    }
    let notes = toNotes(json.Notes);
    cb(notes);
  }
  get('/api/getrecentnotes', null, getNotesCb, cbErr);
}

// calls cb with Note
export function getNote(noteId: any, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'id': noteId
  };
  function getNoteCb(note: any) {
    note = toNote(note);
    cb(note);
  }
  get('/api/getnote', args, getNoteCb, cbErr);
}

// calls cb with UserInfo
export function getUserInfo(userHashID: string, cb: any, cbErr?: any) {
  function getUserInfoCb(userInfo: any) {
    cb(userInfo.UserInfo);
  }
  const args: ArgsDict = {
    'userHashID': userHashID,
  };
  get('/api/getuserinfo', args, getUserInfoCb, cbErr);
}

export function undeleteNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteHashID': noteId
  };
  post('/api/undeletenote', args, cb, cbErr);
}

export function deleteNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteHashID': noteId
  };
  post('/api/deletenote', args, cb, cbErr);
}

export function permanentDeleteNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteHashID': noteId
  };
  post('/api/permanentdeletenote', args, cb, cbErr);
}

export function makeNotePrivate(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteHashID': noteId
  };
  post('/api/makenoteprivate', args, cb, cbErr);
}

export function makeNotePublic(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteHashID': noteId
  };
  post('/api/makenotepublic', args, cb, cbErr);
}

export function starNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteHashID': noteId
  };
  post('/api/starnote', args, cb, cbErr);
}

export function unstarNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteHashID': noteId
  };
  post('/api/unstarnote', args, cb, cbErr);
}

export function createOrUpdateNote(noteJSON: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteJSON': noteJSON
  };
  post('/api/createorupdatenote', args, cb, cbErr);
}

export function searchUserNotes(userHandle: string, searchTerm: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'user': userHandle,
    'term': searchTerm
  };
  get('/api/searchusernotes', args, cb, cbErr);
}

export function importSimpleNoteStart(email: string, pwd: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'email': email,
    'password': pwd
  };
  get('/api/import_simplenote_start', args, cb, cbErr);
}

export function importSimpleNoteStatus(importId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'id': importId
  };
  get('/api/import_simplenote_status', args, cb, cbErr);
}

