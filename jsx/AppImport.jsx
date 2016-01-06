import React from 'react';
import ReactDOM from 'react-dom';
import Top from './Top.jsx';

function appImportStart() {
  console.log('appImportStart: gLoggedInUserHandle: ', gLoggedInUserHandle);
  const isLoggedIn = gLoggedInUserHandle !== '';
  ReactDOM.render(
    <Top isLoggedIn={ isLoggedIn } loggedInUserHandle={ gLoggedInUserHandle } notesUserHandle="" />,
    document.getElementById('header-top')
  );
}

window.appImportStart = appImportStart;
