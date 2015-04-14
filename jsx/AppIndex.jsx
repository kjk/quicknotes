/* jshint -W097,-W117 */
'use strict';

var Top = require('./Top.jsx');

function appIndexStart() {
  console.log("appIndexStart: gLoggedInUserHandle: ", gLoggedInUserHandle);
  var isLoggedIn = gLoggedInUserHandle !== "";
  React.render(
    <Top isLoggedIn={isLoggedIn}
      loggedInUserHandle={gLoggedInUserHandle}
      notesUserHandle="" />,
    document.getElementById('header-top')
  );
}

window.appIndexStart = appIndexStart;
