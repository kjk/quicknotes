import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import Top from './Top.jsx';
import Settings from './Settings.jsx';
import NotesList from './NotesList.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import Editor from './Editor.jsx';
import * as action from './action.js';

export default class AppIndex extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      notes: gRecentNotesInitial
    };
  }

  componentDidMount() {
  }

  componentWillUnmount() {
    //action.offAllForOwner(this);
  }

  /*
    <div id="tagline">
      <h1>QuickNotes is the fastest way to take notes</h1>
    </div>
*/

  render() {
    console.log('AppIndex: gLoggedUser: ', gLoggedUser);
    const notes = this.state.notes;
    return (
      <div>
        <Top />
        <NotesList notes={ notes } compact={ false } showingMyNotes={ false } />
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
}

window.appIndexStart = appIndexStart;
