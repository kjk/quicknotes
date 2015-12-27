/* jshint -W097,-W117 */
'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var Top = require('./Top.jsx');

function appNoteStart() {
  console.log("appNoteStart: gLoggedInUserHandle: ", gLoggedInUserHandle);
  var isLoggedIn = gLoggedInUserHandle !== "";
  ReactDOM.render(
    <Top isLoggedIn={isLoggedIn}
      loggedInUserHandle={gLoggedInUserHandle}
      notesUserHandle="" />,
    document.getElementById('note-top')
  );
}

window.appNoteStart = appNoteStart;
