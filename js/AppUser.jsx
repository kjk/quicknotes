import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import LeftSidebar from './LeftSidebar.jsx';
import NotesList from './NotesList.jsx';
import Router from './Router.js';
import SearchResults from './SearchResults.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import Top from './Top.jsx';
import Settings from './Settings.jsx';
import Editor from './Editor.jsx';
import * as u from './utils.js';
import * as format from './format.js';
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

let gSearchDelayTimerID = null; // TODO: make it variable on AppUser
// if search is in progress, this is the search term
let gCurrSearchTerm = '';

// TODO: make it variable on AppUser

export default class AppUser extends Component {
  constructor(props, context) {
    super(props, context);
    this.handleSearchResultSelected = this.handleSearchResultSelected.bind(this);
    this.handleSearchTermChanged = this.handleSearchTermChanged.bind(this);
    this.handleTagSelected = this.handleTagSelected.bind(this);
    this.reloadNotes = this.reloadNotes.bind(this);

    const initialNotesJSON = props.initialNotesJSON;
    let allNotes = [];
    let selectedNotes = [];
    let selectedTag = props.initialTag;
    let loggedInUserHandle = '';
    let tags = {};

    if (initialNotesJSON && initialNotesJSON.LoggedInUserHandle) {
      loggedInUserHandle = initialNotesJSON.LoggedInUserHandle;
    }
    if (initialNotesJSON && initialNotesJSON.Notes) {
      allNotes = initialNotesJSON.Notes;
      selectedNotes = u.filterNotesByTag(allNotes, selectedTag);
      tags = tagsFromNotes(allNotes);
    }

    this.state = {
      allNotes: allNotes,
      selectedNotes: selectedNotes,
      // TODO: should be an array this.props.initialTags
      selectedTag: selectedTag,
      tags: tags,
      loggedInUserHandle: loggedInUserHandle,
      searchResults: null
    };
  }

  componentDidMount() {
    action.onTagSelected(this.handleTagSelected, this);
    action.onReloadNotes(this.reloadNotes, this);
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
      selectedTag: tag
    });
  }

  setNotes(json) {
    const allNotes = json.Notes || [];
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
      loggedInUserHandle: json.LoggedInUserHandle
    });
  }

  reloadNotes() {
    const userHandle = this.props.notesUserHandle;
    console.log('reloadNotes: userHandle=', userHandle);
    api.getNotesCompact(userHandle, json => {
      this.setNotes(json);
    });
  }

  startSearch(userHandle, searchTerm) {
    gCurrSearchTerm = searchTerm;
    if (searchTerm === '') {
      return;
    }
    api.searchUserNotes(userHandle, searchTerm, json => {
      console.log('finished search for ' + json.Term);
      if (json.Term != gCurrSearchTerm) {
        console.log('discarding search results because not for ' + gCurrSearchTerm);
        return;
      }
      this.setState({
        searchResults: json
      });
    });
  }

  handleSearchTermChanged(searchTerm) {
    gCurrSearchTerm = searchTerm;
    if (searchTerm === '') {
      // user cancelled the search
      clearTimeout(gSearchDelayTimerID);
      this.setState({
        searchResults: null
      });
      return;
    }
    // start search query with a delay to not hammer the server too much
    if (gSearchDelayTimerID) {
      clearTimeout(gSearchDelayTimerID);
    }
    gSearchDelayTimerID = setTimeout(() => {
      console.log('starting search for ' + searchTerm);
      this.startSearch(this.props.notesUserHandle, searchTerm);
    }, 300);
  }

  handleSearchResultSelected(noteIDStr) {
    console.log('search note selected: ' + noteIDStr);
    // TODO: probably should display in-line
    const url = '/n/' + noteIDStr;
    const win = window.open(url, '_blank');
    win.focus();
    // TODO: clear search field and focus it
    this.handleSearchTermChanged(''); // hide search results
  }

  render() {
    const compact = false;
    const isLoggedIn = this.state.loggedInUserHandle !== '';
    const myNotes = isLoggedIn && (this.props.notesUserHandle == this.state.loggedInUserHandle);

    return (
      <div>
        <Top isLoggedIn={ isLoggedIn }
          loggedInUserHandle={ this.state.loggedInUserHandle }
          notesUserHandle={ this.props.notesUserHandle }
          onSearchTermChanged={ this.handleSearchTermChanged } />
        <LeftSidebar tags={ this.state.tags }
          isLoggedIn={ isLoggedIn }
          myNotes={ myNotes }
          onTagSelected={ this.handleTagSelected }
          selectedTag={ this.state.selectedTag } />
        <NotesList notes={ this.state.selectedNotes } myNotes={ myNotes } compact={ compact } />
        <Settings />
        { this.state.searchResults ?
          <SearchResults searchResults={ this.state.searchResults } onSearchResultSelected={ this.handleSearchResultSelected } /> : null }
        <ImportSimpleNote />
        <Editor />
      </div>
      );
  }
}

AppUser.propTypes = {
  notesUserHandle: PropTypes.string,
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
    <AppUser notesUserHandle={ gNotesUserHandle } initialNotesJSON={ gInitialNotesJSON } initialTag={ initialTag } />,
    document.getElementById('root')
  );
}

window.appUserStart = appUserStart;
