import React from 'react';
import ReactDOM from 'react-dom';
import Top from './Top.jsx';

function appImportStart() {
  console.log('appImportStart: gLoggedInUserHandle: ', gLoggedInUserHandle);
  const isLoggedIn = gLoggedInUserHandle !== '';
  const el = document.getElementById('header-top');
  ReactDOM.render(
    <Top isLoggedIn={ isLoggedIn } loggedInUserHandle={ gLoggedInUserHandle } notesUserHandle="" />,
    el);
}

window.appImportStart = appImportStart;
