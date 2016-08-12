import React, { Component } from 'react';
import * as ReactDOM from 'react-dom';

import Editor from './Editor';
import ImportSimpleNote from './ImportSimpleNote';
import NotesList from './NotesList';
import SearchResults from './SearchResults';
import Settings from './Settings';
import TemporaryMessage from './TemporaryMessage';
import Top from './Top';

import { INote } from './noteinfo';
import * as action from './action';

interface State {
  notes: INote[];
}

export default class AppIndex extends Component<{}, State> {
  constructor(props: any, context: any) {
    super(props, context);

    this.handleSearchResultSelected = this.handleSearchResultSelected.bind(this);

    this.state = {
      notes: gRecentNotesInitial
    };
  }

  componentDidMount() { }

  componentWillUnmount() {
    //action.offAllForOwner(this);
  }

  handleSearchResultSelected(noteHashID: string) {
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
