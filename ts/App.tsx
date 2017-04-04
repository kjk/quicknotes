import 'babel-polyfill';

import React from 'react';
import * as ReactDOM from 'react-dom';
import Router from './Router';
import page from 'page';

import * as action from './action';
import * as api from './api';
import AppUser from './AppUser';
import AppNote from './AppNote';
import AppIndex from './AppIndex';
import AppDesktopIndex from './AppDesktopIndex';
import AppDebugShowNotes from './AppDebugShowNotes';
import { Note, toNote, toNotes } from './Note';
import { initElectron } from './electron';

// s is in format "/t:foo/t:bar", returns ["foo", "bar"]
function tagsFromRoute(s: string): string[] {
  const parts = s.split('/t:');
  const res = parts.filter((s: string) => s !== '');
  if (res.length === 0) {
    return ['__all'];
  }
  return res;
}

function appUserStart(ctx: PageJS.Context) {
  const userIDHash = ctx.params.userIDHash;
  console.log('appUserStart: ctx:', ctx, 'userIDHash:', userIDHash);

  const initialTags = tagsFromRoute(Router.getHash());
  const initialTag = initialTags[0];
  console.log('initialTags: ' + initialTags + ' initialTag: ' + initialTag);

  api.getUserInfo(userIDHash, (err: Error, userInfo: UserInfo) => {
    if (err) {
      console.log('Error: ', err);
      return;
    }
    console.log('appUserStart: got user', userInfo);
    gNotesUser = userInfo;
    getNotes();
  });

  function getNotes() {
    api.getNotesCached(userIDHash, gotNotes);
    function gotNotes(err: Error, notes: Note[]) {
      if (!err) {
        renderNotes(notes);
      }
    }
  };

  function renderNotes(notes: Note[]) {
    console.log('appUserStart: got', notes.length, 'notes');
    const el = document.getElementById('root');
    ReactDOM.render(
      <AppUser initialNotes={notes} initialTag={initialTag} />,
      el
    );
  }
}

function appNoteStart(ctx: PageJS.Context) {
  console.log('appNoteStart: ctx:', ctx);

  if (!gInitialNote) {
    // TODO: fetch the note
    console.log('appNoteStart: dont have gInitialNote');
    return;
  }
  const note = toNote(gInitialNote);
  const el = document.getElementById('root');
  ReactDOM.render(<AppNote initialNote={note} />, el);
}

function appIndexStart(ctx: PageJS.Context) {
  console.log('appIndexStart');
  const el = document.getElementById('root');
  ReactDOM.render(<AppIndex />, el);
}

function appDesktopLandingStart(ctx: PageJS.Context) {
  console.log('appDesktopLandingStart');
  if (gLoggedUser) {
    const uri = `/u/${gLoggedUser.HashID}/${gLoggedUser.Handle}`;
    page(uri);
    return;
  }
  const el = document.getElementById('root');
  ReactDOM.render(<AppDesktopIndex />, el);
}

export function appDebugShowNotes() {
  console.log('appDebugShowNotes');
  const el = document.getElementById('root');
  ReactDOM.render(<AppDebugShowNotes />, el);
}

function gotBroadcastedNotes(err: Error, notes: Note[]) {
  if (err) {
    return;
  }
  console.log('got notes');
  action.updateNotes(notes);
}

window.addEventListener('DOMContentLoaded', () => {
  page('/', appIndexStart);
  page('/welcome', appIndexStart);
  page('/u/:userIDHash', appUserStart);
  page('/u/:userIDHash/*', appUserStart);
  page('/n/:noteHashID', appNoteStart);
  page('/n/:noteHashID/*', appNoteStart);
  page('/dbg/shownotes', appDebugShowNotes);
  page();

  initElectron();

  api.wsRegisterForBroadcastedMessage('broadcastUserNotes', gotBroadcastedNotes, api.getNotesConvertResult);
  api.openWebSocket();
});
