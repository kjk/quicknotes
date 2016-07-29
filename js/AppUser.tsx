/// <reference path="../typings/index.d.ts" />

import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';

import Editor from './Editor';
import ImportSimpleNote from './ImportSimpleNote';
import LeftSidebar from './LeftSidebar';
import NotesList from './NotesList';
import Router from './Router';
import SearchResults from './SearchResults';
import Settings from './Settings';
import TemporaryMessage from './TemporaryMessage';
import Top from './Top';

import * as u from './utils';
import * as ni from './noteinfo';
import * as action from './action';
import * as api from './api';

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

/*
AppUser.propTypes = {
  initialTag: PropTypes.string,
  initialNotesJSON: PropTypes.object
};
*/
interface Props {
  initialTag?: string;
  initialNotesJSON?: any;
}

export default class AppUser extends Component<Props, {}> {
  constructor(props, context) {
    super(props, context);

    this.handleSearchResultSelected = this.handleSearchResultSelected.bind(this);
    this.handleTagSelected = this.handleTagSelected.bind(this);
    this.handleReloadNotes = this.handleReloadNotes.bind(this);

    const initialNotesJSON = props.initialNotesJSON;
    let allNotes = [];
    let selectedNotes = [];
    let selectedTags = [props.initialTag];
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
      selectedNotes = u.filterNotesByTags(allNotes, selectedTags);
      tags = tagsFromNotes(allNotes);
    }

    this.state = {
      allNotes: allNotes,
      selectedNotes: selectedNotes,
      selectedTags: selectedTags,
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

  // op = toggle or set
  handleTagSelected(tag, op) {
    //console.log("selected tag: ", tag);
    var tags = this.state.selectedTags;
    if (op == 'set') {
      tags = [tag];
    } else if (op === 'toggle') {
      if (tag === '__all' || tag == '__deleted') {
        return;
      }

      let idx = tags.indexOf(tag);

      if (idx == -1) {
        tags.push(tag);
      } else {
        tags.splice(idx, 1);
      }
    } else {
      console.log('unknown op:', op);
      return;
    }

    const selectedNotes = u.filterNotesByTags(this.state.allNotes, tags);
    // TODO: update url with /t:${tag}
    this.setState({
      selectedNotes: selectedNotes,
      selectedTags: tags,
      resetScroll: true
    });
  }

  setNotes(json, resetScroll) {
    const allNotes = json.Notes || [];
    ni.sortNotesByUpdatedAt(allNotes);
    const tags = tagsFromNotes(allNotes);
    let selectedTags = this.state.selectedTags.filter(tag => tag in tags);
    if (selectedTags.length === 0) {
      selectedTags = ['__all'];
    }

    const selectedNotes = u.filterNotesByTags(allNotes, selectedTags);
    this.setState({
      allNotes: allNotes,
      selectedNotes: selectedNotes,
      tags: tags,
      selectedTags: selectedTags,
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
        <LeftSidebar tags={ this.state.tags } showingMyNotes={ showingMyNotes } selectedTags={ this.state.selectedTags } />
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
