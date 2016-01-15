import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import Top from './Top.jsx';
import Settings from './Settings.jsx';
import RecentNotes from './RecentNotes.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import Editor from './Editor.jsx';
import * as action from './action.js';

export default class AppIndex extends Component {
  constructor(props, context) {
    super(props, context);
  }

  componentDidMount() {
  }

  componentWillUnmount() {
    //action.offAllForOwner(this);
  }

  render() {
    console.log('AppIndex: gLoggedInUserHandle: ', gLoggedInUserHandle);
    const isLoggedIn = gLoggedInUserHandle !== '';
    return (
      <div>
        <Top isLoggedIn={ isLoggedIn } loggedInUserHandle={ gLoggedInUserHandle } notesUserHandle="" />
        <Settings />
        <ImportSimpleNote />
        <Editor />
      </div>
      );
  }
}

function appIndexStart() {
  ReactDOM.render(
    <AppIndex />,
    document.getElementById('root')
  );
  ReactDOM.render(
    <RecentNotes />,
    document.getElementById('recent-notes-wrapper')
  );
}

window.appIndexStart = appIndexStart;
