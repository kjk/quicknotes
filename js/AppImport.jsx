import React from 'react';
import ReactDOM from 'react-dom';
import Top from './Top.jsx';

function appImportStart() {
  console.log('appImportStart: gLoggedUser: ', gLoggedUser);
  const el = document.getElementById('header-top');
  ReactDOM.render(
    <Top />,
    el);
}

window.appImportStart = appImportStart;
