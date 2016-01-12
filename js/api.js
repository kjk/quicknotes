import nanoajax from 'nanoajax';

// TODO: audit for error handling

function buildArgs(args) {
  if (!args) {
    return null;
  }
  let parts = [];
  for (let key in args) {
    const val = args[key];
    const p = encodeURIComponent(key) + '=' + encodeURIComponent(val);
    parts.push(p);
  }
  return parts.join('&');
}

function handleResponse(code, respTxt, cb, cbErr) {
  if (!cb) {
    return;
  }
  respTxt = respTxt || '{}';
  let js;
  if (code == 200) {
    js = JSON.parse(respTxt);
  } else {
    console.log(`handleResponse: code=${code}, respTxt='${respTxt}'`);
    js['error'] = `request returned code ${code}, text: '${respTxt}'`;
  }
  const errMsg = js['error'];
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

function get(url, args, cb, cbErr) {
  const urlArgs = buildArgs(args);
  if (urlArgs) {
    url += '?' + urlArgs;
  }
  const opt = {
    url: url
  };
  nanoajax.ajax(opt, (code, respTxt) => {
    handleResponse(code, respTxt, cb, cbErr);
  });
}

function post(url, args, cb, cbErr) {
  const opts = {
    method: 'POST',
    url: url
  };
  const urlArgs = buildArgs(args);
  if (urlArgs) {
    opts['body'] = urlArgs;
  }
  nanoajax.ajax(args, (code, respTxt) => {
    handleResponse(code, respTxt, cb, cbErr);
  });
}

export function getNotesCompact(userHandle, cb, cbErr) {
  const args = {
    'user': userHandle
  };
  get('/api/getnotescompact.json', args, cb, cbErr);
}

export function getNoteCompact(noteId, cb, cbErr) {
  const args = {
    'id': noteId
  };
  get('/api/getnotecompact.json', args, cb, cbErr);
}

export function undeleteNote(noteId, cb, cbErr) {
  const args = {
    'noteIdHash': noteId
  };
  post('/api/undeletenote.json', args, cb, cbErr);
}

export function deleteNote(noteId, cb, cbErr) {
  const args = {
    'noteIdHash': noteId
  };
  post('/api/deletenote.json', args, cb, cbErr);
}

export function permanentDeleteNote(noteId, cb, cbErr) {
  const args = {
    'noteIdHash': noteId
  };
  post('/api/permanentdeletenote.json', args, cb, cbErr);
}

export function makeNotePrivate(noteId, cb, cbErr) {
  const args = {
    'noteIdHash': noteId
  };
  post('/api/makenoteprivate.json', args, cb, cbErr);
}

export function makeNotePublic(noteId, cb, cbErr) {
  const args = {
    'noteIdHash': noteId
  };
  post('/api/makenotepublic.json', args, cb, cbErr);
}

export function starNote(noteId, cb, cbErr) {
  const args = {
    'noteIdHash': noteId
  };
  post('/api/starnote.json', args, cb, cbErr);
}

export function unstarNote(noteId, cb, cbErr) {
  const args = {
    'noteIdHash': noteId
  };
  post('/api/unstarnote.json', args, cb, cbErr);
}

export function createOrUpdateNote(noteJSON, cb, cbErr) {
  const args = {
    'noteJSON': noteJSON
  };
  post('/api/createorupdatenote.json', args, cb, cbErr);
}

export function searchUserNotes(userHandle, searchTerm, cb, cbErr) {
  const args = {
    'user': userHandle,
    'term': searchTerm
  };
  get('/api/searchusernotes.json', args, cb, cbErr);
}