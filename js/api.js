import $ from 'jquery';

export function getNotesCompact(userHandle, cb) {
  const arg = encodeURIComponent(userHandle);
  const uri = '/api/getnotescompact.json?user=' + arg;
  $.get(uri, cb);
  // TODO: show an error message on error
}

export function getNoteCompact(noteId, cb) {
  const arg = encodeURIComponent(noteId);
  const uri = '/api/getnotecompact.json?id=' + arg;
  $.get(uri, cb);
  // TODO: show an error message on error
}

export function undeleteNote(noteId, cb) {
  const data = {
    noteIdHash: noteId
  };
  $.post('/api/undeletenote.json', data, cb)
    .fail(() => {
      alert('error undeleting a note');
    });
}

export function deleteNote(noteId, cb) {
  const data = {
    noteIdHash: noteId
  };
  $.post('/api/deletenote.json', data, cb)
    .fail(() => {
      alert('error deleting a note');
    });
}

export function permanentDeleteNote(noteId, cb) {
  const data = {
    noteIdHash: noteId
  };
  $.post('/api/permanentdeletenote.json', data, cb)
    .fail(() => {
      alert('error permenently deleting a note');
    });
}

export function makeNotePrivate(noteId, cb) {
  const data = {
    noteIdHash: noteId
  };
  $.post('/api/makenoteprivate.json', data, cb)
    .fail(() => {
      alert('error making note private');
    });
}

export function makeNotePublic(noteId, cb) {
  const data = {
    noteIdHash: noteId
  };
  $.post('/api/makenotepublic.json', data, cb)
    .fail(() => {
      alert('error making note public');
    });
}

export function starNote(noteId, cb) {
  const data = {
    noteIdHash: noteId
  };
  $.post('/api/starnote.json', data, cb)
    .fail(() => {
      alert('error starring a note');
    });
}

export function unstarNote(noteId, cb) {
  const data = {
    noteIdHash: noteId
  };
  $.post('/api/unstarnote.json', data, cb)
    .fail(() => {
      alert('error unstarring a note');
    });
}

export function createOrUpdateNote(noteJSON, cb) {
  const data = {
    noteJSON: noteJSON
  };
  $.post('/api/createorupdatenote.json', data, cb)
    .fail(() => {
      alert('error in createOrUpdateNote a note');
    });
}

export function searchUserNotes(userHandle, searchTerm, cb) {
  const u = encodeURIComponent(userHandle);
  const t = encodeURIComponent(searchTerm);
  const uri = '/api/searchusernotes.json?user=' + u + '&term=' + t;
  $.get(uri, cb);
  // TODO: show error
}