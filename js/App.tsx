import 'babel-polyfill';

import React from 'react';
import page from 'page';

import * as ReactDOM from 'react-dom';
import Router from './Router';

import AppUser from './Appuser';
import AppNote from './AppNote';
import AppIndex from './AppIndex';

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
  console.log('appUserStart');

  //console.log("gNotesUserHandle: ", gNotesUserHandle);
  const initialTags = tagsFromRoute(Router.getHash());
  const initialTag = initialTags[0];
  //console.log("initialTags: " + initialTags + " initialTag: " + initialTag);
  //console.log("gInitialNotesJSON.Notes.length: ", gInitialNotesJSON.Notes.length);

  const el = document.getElementById('root');
  ReactDOM.render(
    <AppUser initialNotesJSON={gInitialNotesJSON} initialTag={initialTag} />,
    el
  );
}

function appNoteStart(ctx: PageJS.Context) {
  console.log('appNoteStart');

  const el = document.getElementById('root');
  ReactDOM.render(<AppNote />, el);
}

function appIndexStart(ctx: PageJS.Context) {
  console.log('appIndexStart');

  const el = document.getElementById('root');
  ReactDOM.render(<AppIndex />, el);
}

function notFound(ctx: PageJS.Context) {
  console.log('notFound');
}

window.addEventListener('DOMContentLoaded', () => {
  page('/', appIndexStart);
  page('/u/:userIdHash', appUserStart);
  page('/u/:userIdHash/*', appUserStart);
  page('/n/:noteIdHash', appNoteStart);
  page('/n/:noteIdHash/*', appNoteStart);
  page('/*', notFound);
  page();
});
