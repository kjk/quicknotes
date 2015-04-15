/* jshint -W097,-W117 */
'use strict';

var Top = require('./Top.jsx');

function appImportStart() {
  console.log("appImportStart: gLoggedInUserHandle: ", gLoggedInUserHandle);
  var isLoggedIn = gLoggedInUserHandle !== "";
  React.render(
    <Top isLoggedIn={isLoggedIn}
      loggedInUserHandle={gLoggedInUserHandle}
      notesUserHandle="" />,
    document.getElementById('header-top')
  );
}

window.appImportStart = appImportStart;
