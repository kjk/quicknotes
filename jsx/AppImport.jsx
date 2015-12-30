import ReactDOM from 'react-dom';
import Top from './Top.jsx';

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
