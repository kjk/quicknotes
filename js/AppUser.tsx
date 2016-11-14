import React, { Component, PropTypes } from 'react';
import * as ReactDOM from 'react-dom';

import Editor from './Editor';
import ImportSimpleNote from './ImportSimpleNote';
import LeftSidebar from './LeftSidebar';
import NotesList from './NotesList';
import SearchResults from './SearchResults';
import Settings from './Settings';
import TemporaryMessage from './TemporaryMessage';
import Top from './Top';

import * as u from './utils';
import {
  Note,
  TagToCount,
  sortNotesByUpdatedAt,
  toNotes
} from './Note';
import * as action from './action';
import * as api from './api';

function tagsFromNotes(notes: Note[]): TagToCount {
  if (!notes) {
    return {};
  }

  let tags: TagToCount = {
    __all: 0,
    __deleted: 0,
    __public: 0,
    __private: 0,
    __starred: 0,
  };

  for (let note of notes) {
    // a deleted note won't show up under other tags or under "all" or "public"
    if (note.IsDeleted()) {
      tags["__deleted"] += 1;
      continue;
    }

    tags["__all"] += 1;
    if (note.IsStarred()) {
      tags["__starred"] += 1;
    }

    if (note.IsPublic()) {
      tags["__public"] += 1;
    } else {
      tags["__private"] += 1;
    }

    for (let tag of note.Tags()) {
      u.dictInc(tags, tag);
    }
  }

  return tags;
}

interface Props {
  initialTag?: string;
  initialNotesJSON?: any;
}

interface State {
  allNotes?: Note[];
  selectedNotes?: Note[];
  selectedTags?: string[];
  tags?: TagToCount;
  notesUserHashID?: string;
  notesUserHandle?: string;
  loggedUserHashID?: string;
  loggedUserHandle?: string;
  resetScroll?: boolean;
}

export default class AppUser extends Component<Props, State> {
  constructor(props?: Props, context?: any) {
    super(props, context);

    this.handleSearchResultSelected = this.handleSearchResultSelected.bind(this);
    this.handleTagSelected = this.handleTagSelected.bind(this);
    this.handleReloadNotes = this.handleReloadNotes.bind(this);

    const initialNotesJSON = props.initialNotesJSON;
    let allNotes: Note[] = [];
    let selectedNotes: Note[] = [];
    let selectedTags = [props.initialTag];
    let tags: TagToCount = {};

    let loggedUserHandle = '';
    let loggedUserHashID = '';
    if (gLoggedUser) {
      loggedUserHandle = gLoggedUser.Handle;
      loggedUserHashID = gLoggedUser.HashID;
    }

    if (initialNotesJSON && initialNotesJSON.Notes) {
      allNotes = toNotes(initialNotesJSON.Notes);
      sortNotesByUpdatedAt(allNotes);
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
  handleTagSelected(tag: string, op: string) {
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

  setNotes(allNotes: Note[], resetScroll: boolean) {
    sortNotesByUpdatedAt(allNotes);
    const tags = tagsFromNotes(allNotes);
    let selectedTags = this.state.selectedTags.filter((tag: any) => tag in tags);
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

  handleReloadNotes(resetScroll: boolean) {
    const userID = this.state.notesUserHashID;
    // console.log('reloadNotes: userID=', userID, ' resetScroll=', resetScroll);
    api.getNotes(userID, (notes: Note[]) => {
      this.setNotes(notes, resetScroll);
    });
  }

  handleSearchResultSelected(noteHashID: string) {
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
        <LeftSidebar tags={this.state.tags} showingMyNotes={showingMyNotes} selectedTags={this.state.selectedTags} />
        <NotesList notes={this.state.selectedNotes}
          showingMyNotes={showingMyNotes}
          compact={false}
          resetScroll={this.state.resetScroll} />
        <Settings />
        <SearchResults onSearchResultSelected={this.handleSearchResultSelected} />
        <ImportSimpleNote />
        <Editor />
        <TemporaryMessage />
      </div>
    );
  }
}
