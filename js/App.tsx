import 'babel-polyfill';

import React from 'react';
import page from 'page';

import * as ReactDOM from 'react-dom';
import Router from './Router';

import { UserInfo } from './types';
import AppUser from './AppUser';
import AppNote from './AppNote';
import AppIndex from './AppIndex';
import { Note, toNote, toNotes } from './Note';
import * as api from './api';

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
  console.log("initialTags: " + initialTags + " initialTag: " + initialTag);

  api.getUserInfo(userIDHash, (err: Error, userInfo: UserInfo) => {
    if (err) {
      console.log("Error: ", err);
      return;
    }
    console.log('appUserStart: got user', userInfo);
    gNotesUser = userInfo;
    getNotes();
  })

  function getNotes() {
    api.getNotes(userIDHash, (err: Error, notes: Note[]) => {
      if (err) {
        return;
      }
      console.log('appUserStart: got', notes.length, 'notes');
      const el = document.getElementById('root');
      ReactDOM.render(
        <AppUser initialNotes={notes} initialTag={initialTag} />,
        el
      );
    })
  };
}

function appNoteStart(ctx: PageJS.Context) {
  console.log('appNoteStart: ctx:', ctx);

  if (!gInitialNote) {
    // TODO: fetch the note
    console.log('appNoteStart: dont have gInitialNote')
    return;
  }
  const note = toNote(gInitialNote);
  const el = document.getElementById('root');
  ReactDOM.render(<AppNote initialNote={note} />, el);
}

function appIndexStart(ctx: PageJS.Context) {
  console.log('appIndexStart');

  api.getRecentNotes((err: Error, notes: Note[]) => {
    if (err) {
      console.log("api.getRecentNotes failed with:", err);
      return;
    }
    console.log('appIndexStart: got', notes.length, 'notes');
    const el = document.getElementById('root');
    ReactDOM.render(<AppIndex initialNotes={notes} />, el);
  });
}

function appDesktopLandingStart(ctx: PageJS.Context) {
  console.log('appDesktopLandingStart');
  if (gLoggedUser) {
    const uri = `/u/${gLoggedUser.HashID}/${gLoggedUser.Handle}`;
    page(uri);
    return;
  }
  // TODO: go to login page
  page('/');
}

window.addEventListener('DOMContentLoaded', () => {
  api.openWebSocket();

  page('/', appIndexStart);
  page('/dskstart', appDesktopLandingStart)
  page('/u/:userIDHash', appUserStart);
  page('/u/:userIDHash/*', appUserStart);
  page('/n/:noteHashID', appNoteStart);
  page('/n/:noteHashID/*', appNoteStart);
  page();
});
