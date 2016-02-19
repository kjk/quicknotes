'use strict';

import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';

import Editor from './Editor.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import LeftSidebar from './LeftSidebar.jsx';
import NotesList from './NotesList.jsx';
import Router from './Router.js';
import SearchResults from './SearchResults.jsx';
import Settings from './Settings.jsx';
import TemporaryMessage from './TemporaryMessage.jsx';
import Top from './Top.jsx';

import * as u from './utils.js';
import * as ni from './noteinfo.js';
import * as action from './action.js';
import * as api from './api.js';

// returns { tagName1: count, ... }
function tagsFromNotes(notes) {
  let tags = {
    __all: 0,
    __deleted: 0,
    __public: 0,
    __private: 0,
    __starred: 0,
  };
  if (!notes) {
    return {};
  }

  for (let note of notes) {
    // a deleted note won't show up under other tags or under "all" or "public"
    if (ni.IsDeleted(note)) {
      tags.__deleted += 1;
      continue;
    }

    tags.__all += 1;
    if (ni.IsStarred(note)) {
      tags.__starred += 1;
    }

    if (ni.IsPublic(note)) {
      tags.__public += 1;
    } else {
      tags.__private += 1;
    }

    const noteTags = ni.Tags(note);
    if (noteTags !== null) {
      for (let tag of noteTags) {
        u.dictInc(tags, tag);
      }
    }
  }

  return tags;
}

export default class AppUser extends Component {
  constructor(props, context) {
    super(props, context);

    this.handleSearchResultSelected = this.handleSearchResultSelected.bind(this);
    this.handleTagSelected = this.handleTagSelected.bind(this);
    this.handleReloadNotes = this.handleReloadNotes.bind(this);

    const initialNotesJSON = props.initialNotesJSON;
    let allNotes = [];
    let selectedNotes = [];
    let selectedTag = props.initialTag;
    let tags = {};

    let loggedUserHandle = '';
    let loggedUserHashID = '';
    if (gLoggedUser) {
      loggedUserHandle = gLoggedUser.Handle;
      loggedUserHashID = gLoggedUser.HashID;
    }

    if (initialNotesJSON && initialNotesJSON.Notes) {
      allNotes = initialNotesJSON.Notes;
      ni.sortNotesByUpdatedAt(allNotes);
      selectedNotes = u.filterNotesByTag(allNotes, selectedTag);
      tags = tagsFromNotes(allNotes);
    }

    this.state = {
      allNotes: allNotes,
      selectedNotes: selectedNotes,
      // TODO: should be an array this.props.initialTags
      selectedTag: selectedTag,
      tags: tags,
      notesUserHashID: gNotesUser.HashID,
      notesUserHandle: gNotesUser.Handle,
      loggedUserHashID: loggedUserHashID,
      loggedUserHandle: loggedUserHandle,
      resetScroll: false
    };
  }

  componentDidMount() {
    action.onTagSelected(this.handleTagSelected, this);
    action.onReloadNotes(this.handleReloadNotes, this);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  handleTagSelected(tag) {
    //console.log("selected tag: ", tag);
    const selectedNotes = u.filterNotesByTag(this.state.allNotes, tag);
    // TODO: update url with /t:${tag}
    this.setState({
      selectedNotes: selectedNotes,
      selectedTag: tag,
      resetScroll: true
    });
  }

  setNotes(json, resetScroll) {
    const allNotes = json.Notes || [];
    ni.sortNotesByUpdatedAt(allNotes);
    const tags = tagsFromNotes(allNotes);
    let selectedTag = this.state.selectedTag;
    if (!(selectedTag in tags)) {
      selectedTag = '__all';
    }
    const selectedNotes = u.filterNotesByTag(allNotes, selectedTag);
    this.setState({
      allNotes: allNotes,
      selectedNotes: selectedNotes,
      tags: tags,
      selectedTag: selectedTag,
      resetScroll: resetScroll
    });
  }

  handleReloadNotes(resetScroll) {
    const userID = this.state.notesUserHashID;
    // console.log('reloadNotes: userID=', userID, ' resetScroll=', resetScroll);
    api.getNotes(userID, json => {
      this.setNotes(json, resetScroll);
    });
  }

  handleSearchResultSelected(noteHashID) {
    console.log('search note selected: ' + noteHashID);
    // TODO: probably should display in-line
    const url = '/n/' + noteHashID;
    const win = window.open(url, '_blank');
    win.focus();
  }

  render() {
    const showingMyNotes = u.isLoggedIn() && (this.state.notesUserHashID == this.state.loggedUserHashID);

    return (
      <div>
        <Top />
        <LeftSidebar tags={ this.state.tags }
          showingMyNotes={ showingMyNotes }
          onTagSelected={ this.handleTagSelected }
          selectedTag={ this.state.selectedTag } />
        <NotesList notes={ this.state.selectedNotes }
          showingMyNotes={ showingMyNotes }
          compact={ false }
          resetScroll={ this.state.resetScroll } />
        <Settings />
        <SearchResults onSearchResultSelected={ this.handleSearchResultSelected } />
        <ImportSimpleNote />
        <Editor />
        <TemporaryMessage />
      </div>
      );
  }
}

AppUser.propTypes = {
  initialTag: PropTypes.string,
  initialNotesJSON: PropTypes.object
};

// s is in format "/t:foo/t:bar", returns ["foo", "bar"]
function tagsFromRoute(s) {
  const parts = s.split('/t:');
  const res = parts.filter((s) => s !== '');
  if (res.length === 0) {
    return ['__all'];
  }
  return res;
}

function appUserStart() {
  //console.log("gNotesUserHandle: ", gNotesUserHandle);
  const initialTags = tagsFromRoute(Router.getHash());
  const initialTag = initialTags[0];
  //console.log("initialTags: " + initialTags + " initialTag: " + initialTag);
  //console.log("gInitialNotesJSON.Notes.length: ", gInitialNotesJSON.Notes.length);

  ReactDOM.render(
    <AppUser initialNotesJSON={ gInitialNotesJSON } initialTag={ initialTag } />,
    document.getElementById('root')
  );
}

window.appUserStart = appUserStart;
