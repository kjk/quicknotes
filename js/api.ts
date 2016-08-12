import { ajax, Params } from './ajax';
import { Dict } from './utils';

type ArgsDict = Dict<string>;

// TODO: audit for error handling

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

export function getNotes(userHandle: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'user': userHandle
  };
  get('/api/getnotes', args, cb, cbErr);
}

export function getNote(noteId: any, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'id': noteId
  };
  get('/api/getnote', args, cb, cbErr);
}

export function undeleteNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteIdHash': noteId
  };
  post('/api/undeletenote', args, cb, cbErr);
}

export function deleteNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteIdHash': noteId
  };
  post('/api/deletenote', args, cb, cbErr);
}

export function permanentDeleteNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteIdHash': noteId
  };
  post('/api/permanentdeletenote', args, cb, cbErr);
}

export function makeNotePrivate(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteIdHash': noteId
  };
  post('/api/makenoteprivate', args, cb, cbErr);
}

export function makeNotePublic(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteIdHash': noteId
  };
  post('/api/makenotepublic', args, cb, cbErr);
}

export function starNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteIdHash': noteId
  };
  post('/api/starnote', args, cb, cbErr);
}

export function unstarNote(noteId: string, cb: any, cbErr?: any) {
  const args: ArgsDict = {
    'noteIdHash': noteId
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
