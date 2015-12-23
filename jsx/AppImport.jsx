/* jshint -W097,-W117 */
'use strict';

var ReactDOM = require('react-dom');

var Top = require('./Top.jsx');

function appImportStart() {
  console.log("appImportStart: gLoggedInUserHandle: ", gLoggedInUserHandle);
  var isLoggedIn = gLoggedInUserHandle !== "";
  ReactDOM.render(
    <Top isLoggedIn={isLoggedIn}
      loggedInUserHandle={gLoggedInUserHandle}
      notesUserHandle="" />,
    document.getElementById('header-top')
  );
}

window.appImportStart = appImportStart;
