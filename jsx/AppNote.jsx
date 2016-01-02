import React from 'react';
import ReactDOM from 'react-dom';
import Top from './Top.jsx';

function appNoteStart() {
  console.log('appNoteStart: gLoggedInUserHandle: ', gLoggedInUserHandle);
  const isLoggedIn = gLoggedInUserHandle !== '';
  ReactDOM.render(
    <Top isLoggedIn={ isLoggedIn } loggedInUserHandle={ gLoggedInUserHandle } notesUserHandle="" />,
    document.getElementById('note-top')
  );
}

window.appNoteStart = appNoteStart;
