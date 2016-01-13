import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import Top from './Top.jsx';
import Settings from './Settings.jsx';
import RecentNotes from './RecentNotes.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import * as action from './action.js';

export default class AppIndex extends Component {
  constructor(props, context) {
    super(props, context);

    this.handleStartNewNote = this.handleStartNewNote.bind(this);
  }

  componentDidMount() {
  }

  componentWillUnmount() {
    //action.offAllForOwner(this);
  }

  handleStartNewNote() {
    console.log('handleStartNewNote');
  }

  render() {
    console.log('AppIndex: gLoggedInUserHandle: ', gLoggedInUserHandle);
    const isLoggedIn = gLoggedInUserHandle !== '';
    return (
      <div>
        <Top isLoggedIn={ isLoggedIn }
          loggedInUserHandle={ gLoggedInUserHandle }
          onStartNewNote={ this.handleStartNewNote }
          notesUserHandle="" />
        <Settings />
        <ImportSimpleNote />
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
