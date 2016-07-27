'use strict';

import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import Editor from './Editor.tsx';
import ImportSimpleNote from './ImportSimpleNote.tsx';
import NotesList from './NotesList.tsx';
import SearchResults from './SearchResults.tsx';
import Settings from './Settings.tsx';
import TemporaryMessage from './TemporaryMessage.tsx';
import Top from './Top.tsx';

import * as action from './action.ts';

export default class AppIndex extends Component {
  constructor(props, context) {
    super(props, context);

    this.handleSearchResultSelected = this.handleSearchResultSelected.bind(this);

    this.state = {
      notes: gRecentNotesInitial
    };
  }

  componentDidMount() {}

  componentWillUnmount() {
    //action.offAllForOwner(this);
  }

  handleSearchResultSelected(noteHashID) {
    // console.log('search note selected: ' + noteHashID);
    // TODO: probably should display in-line
    const url = '/n/' + noteHashID;
    const win = window.open(url, '_blank');
    win.focus();
  }

  render() {
    // console.log('AppIndex: gLoggedUser: ', gLoggedUser);
    const notes = this.state.notes;
    return (
      <div>
        <Top />
        <div id='tagline'>
          <h1>QuickNotes is the fastest way to take notes</h1>
        </div>
        <NotesList notes={ notes } compact={ false } showingMyNotes={ false } />
        <Settings />
        <SearchResults onSearchResultSelected={ this.handleSearchResultSelected } />
        <ImportSimpleNote />
        <Editor />
        <TemporaryMessage />
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
