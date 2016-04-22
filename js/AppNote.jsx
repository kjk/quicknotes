'use strict';

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import keymaster from 'keymaster';

import { toHtml } from './md.js';
import './linkify.js';

import Editor from './Editor.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import SearchResults from './SearchResults.jsx';
import Settings from './Settings.jsx';
import TemporaryMessage from './TemporaryMessage.jsx';
import Top from './Top.jsx';

import { escapeHtml } from './utils.js';
import * as ni from './noteinfo.js';
import * as api from './api.js';
import * as action from './action.js';

function linkifyCb(s, href) {
  if (!href) {
    return escapeHtml(s);
  }
  return `<a href="${href}" target="_blank" rel="nofollow">${s}</a>`;
}

function linkify2(s) {
  return linkify(s, {
    callback: linkifyCb
  });
}

export default class AppNote extends Component {
  constructor(props, context) {
    super(props, context);

    this.handleSearchResultSelected = this.handleSearchResultSelected.bind(this);

    this.handleDelUndel = this.handleDelUndel.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
    this.handleEditNote = this.handleEditNote.bind(this);
    this.handleMakePublicPrivate = this.handleMakePublicPrivate.bind(this);
    this.handleReloadNotes = this.handleReloadNotes.bind(this);
    this.handlePermanentDelete = this.handlePermanentDelete.bind(this);
    this.handleStarUnstarNote = this.handleStarUnstarNote.bind(this);
    this.handleVersions = this.handleVersions.bind(this);

    this.editCurrentNote = this.editCurrentNote.bind(this);
    this.isMyNote = this.isMyNote.bind(this);
    this.setNote = this.setNote.bind(this);

    this.state = {
      note: gInitialNote
    };
  }

  componentDidMount() {
    if (this.isMyNote()) {
      //keymaster('ctrl+e', this.editCurrentNote);
      keymaster('ctrl+n', () => action.editNewNote());
    }
    action.onReloadNotes(this.handleReloadNotes, this);
  }

  componentWillUnmount() {
    if (this.isMyNote()) {
      //keymaster.unbind('ctrl+e');
      keymaster.unbind('ctrl+n');
    }
    action.offAllForOwner(this);
  }

  isMyNote() {
    return gLoggedUser && gLoggedUser.HashID === gNoteUser.HashID;
  }

  // the content we have might be stale (modified in another
  // browser window), so re-get the content
  editCurrentNote() {
    const note = this.state.note;
    const id = ni.HashID(note);
    // console.log('editCurrentNote id: ', id);
    api.getNote(id, json => {
      // TODO: handle error
      action.editNote(json);
    });
  }

  setNote(note) {
    // TODO: handle the error
    this.setState({
      note: note
    });
  }

  // sent when editor saved a note, so reload it
  handleReloadNotes(resetScroll) {
    const note = this.state.note;
    const noteID = ni.HashID(note);
    api.getNote(noteID, note => {
      this.setNote(note);
    });
  }

  handleSearchResultSelected(noteHashID) {
    // console.log('search note selected: ' + noteHashID);
    // TODO: probably should display in-line
    const url = '/n/' + noteHashID;
    const win = window.open(url, '_blank');
    win.focus();
  }

  handleEditNote(e) {
    e.preventDefault();
    this.editCurrentNote();
  }

  handleDoubleClick(e) {
    console.log('doubleclick');
    e.preventDefault();
    if (this.isMyNote()) {
      this.editCurrentNote();
    }
  }

  handleDelUndel(e) {
    e.preventDefault();
    const note = this.state.note;
    const noteID = ni.HashID(note);
    if (ni.IsDeleted(note)) {
      action.showTemporaryMessage('Undeleting note...', 500);
      api.undeleteNote(noteID, note => {
        // TODO: handle error
        action.showTemporaryMessage(`Undeleted <a href="/n/${noteID}" target="_blank">note</a>.`);
        this.setNote(note);
      });
    } else {
      action.showTemporaryMessage('Moving note to trash...', 500);
      api.deleteNote(noteID, note => {
        // TODO: handle error
        action.showTemporaryMessage(`Moved <a href="/n/${noteID}" target="_blank">note</a> to trash.`);
        this.setNote(note);
      });
    }
  }

  handlePermanentDelete(e) {
    e.preventDefault();
    const note = this.state.note;
    const noteID = ni.HashID(note);
    action.showTemporaryMessage('Permanently deleting note...', 500);
    api.permanentDeleteNote(noteID, () => {
      // TODO: handle error
      // TODO: allow undoe
      action.showTemporaryMessage(`Permanently deleted note.`);
      this.setNote(null);
    });
  }

  handleMakePublicPrivate(e) {
    e.preventDefault();
    const note = this.state.note;
    // console.log('handleMakePublicPrivate, note.IsPublic: ', ni.IsPublic(note));
    const noteID = ni.HashID(note);
    if (ni.IsPublic(note)) {
      action.showTemporaryMessage('Making note private...', 500);
      api.makeNotePrivate(noteID, note => {
        // TODO: handle error
        action.showTemporaryMessage(`Made <a href="/n/${noteID}" target="_blank">note</a> private.`);
        this.setNote(note);
      });
    } else {
      action.showTemporaryMessage('Making note public...', 500);
      api.makeNotePublic(noteID, note => {
        // TODO: handle error
        action.showTemporaryMessage(`Made <a href="/n/${noteID}" target="_blank">note</a> public.`);
        this.setNote(note);
      });
    }
  }

  handleStarUnstarNote(e) {
    e.preventDefault();
    const note = this.state.note;
    // console.log('handleStarUnstarNote, note.IsStarred: ', ni.IsStarred(note));
    const noteID = ni.HashID(note);
    if (ni.IsStarred(note)) {
      action.showTemporaryMessage('Un-starring the note...', 500);
      api.unstarNote(noteID, note => {
        // TODO: handle error
        action.showTemporaryMessage(`Unstarred <a href="/n/${noteID}" target="_blank">note</a>.`);
        this.setNote(note);
      });
    } else {
      action.showTemporaryMessage('Starring the note...', 500);
      api.starNote(noteID, note => {
        // TODO: handle error
        action.showTemporaryMessage(`Starred <a href="/n/${noteID}" target="_blank">note</a>.`);
        this.setNote(note);
      });
    }
  }

  handleVersions(e) {
    e.preventDefault();
    console.log('show note versions');
  }

  renderEdit(note) {
    if (ni.IsDeleted(note)) {
      return;
    }
    return <a href="#" onClick={ this.handleEditNote }>Edit</a>;
  }

  renderVersions(note) {
    //return <a href="#" onClick={ this.handleVersions }>Versions</a>;
  }

  renderStarUnstar(note) {
    if (ni.IsDeleted(note)) {
      return;
    }
    const s = ni.IsStarred(note) ? 'Unstar' : 'Star';
    return <a href="#" onClick={ this.handleStarUnstarNote }>
             { s }
           </a>;
  }

  renderMakePublicPrivate(note) {
    if (ni.IsDeleted(note)) {
      return;
    }
    const s = ni.IsPublic(note) ? 'Make private' : 'Make public';
    return <a href="#" onClick={ this.handleMakePublicPrivate }>
             { s }
           </a>;
  }

  renderTrashUntrash(note) {
    const s = ni.IsDeleted(note) ? 'Undelete' : 'Move to Trash';
    return <a href="#" onClick={ this.handleDelUndel }>
             { s }
           </a>;
  }

  renderPermanentDelete(note) {
    if (ni.IsDeleted(note)) {
      return <a href="#" onClick={ this.handlePermanentDelete }>Delete permanently</a>;
    }
  }

  renderBody(note) {
    const body = ni.GetContentDirect(note);
    const fmtName = ni.Format(note);
    const isTxt = fmtName == ni.formatText;
    if (isTxt) {
      const html = {
        __html: linkify2(body)
      };
      return <pre onDoubleClick={ this.handleDoubleClick } dangerouslySetInnerHTML={ html }></pre>;
    }
    const html = {
      __html: toHtml(body)
    };

    return <div onDoubleClick={ this.handleDoubleClick } dangerouslySetInnerHTML={ html }></div>;
  }

  renderTags(tags) {
    const tagEls = tags.map(tag => {
      tag = '#' + tag;
      return (
        <span className="note-tag" key={ tag }>{ tag }</span>
        );
    });

    return (
      <span className="note-tags">{ tagEls }</span>
      );
  }

  renderPublicPrivate(note) {
    const isPublic = ni.IsPublic(note);
    if (isPublic) {
      return <span className="is-public">public</span>;
    } else {
     return <span className="is-private">private</span>;
    }
  }

  renderDeletedState(note) {
    const isDeleted = ni.IsDeleted(note);
    if (isDeleted) {
      return <span className="is-deleted">deleted</span>;
    }
  }

  renderNoteDeleted() {
    const nu = gNoteUser;
    const url = `/u/${nu.HashID}/${nu.Handle}`;

    return (
      <div>
        <div id="note-top">
          <Top />
        </div>
        <div id="full-note">
          <div className="note-content-wrapper">
            <center className="note-deleted">
              This note has been permanently deleted.
            </center>
          </div>
          <hr className="light" />
          <center className="note-footer">
            A note by&nbsp;
            <a href={ url }>
              { nu.Handle }
            </a>.
          </center>
        </div>
        <Settings />
        <SearchResults onSearchResultSelected={ this.handleSearchResultSelected } />
        <ImportSimpleNote />
        <Editor />
        <TemporaryMessage />
      </div>
      );
  }

  render() {
    const note = this.state.note;
    if (!note) {
      return this.renderNoteDeleted();
    }

    // console.log('AppNote.render: gLoggedUser: ', gLoggedUser, ' note.IsPublic:', ni.IsPublic(note));
    const title = ni.Title(note);
    const nu = gNoteUser;
    const url = `/u/${nu.HashID}/${nu.Handle}`;
    const tags = ni.Tags(note);

    return (
      <div>
        <div id="note-top">
          <Top />
        </div>
        <div id="full-note">
          <div className="note-content-wrapper">
            <div className="full-note-top">
              <h1>{ title }</h1>
              { this.renderTags(tags) }
              { this.renderPublicPrivate(note) }
              { this.renderDeletedState(note) }

              <div className="flex-spacer"></div>
              { this.isMyNote() ?
                <div className="menu-trigger">
                  <i className="fa fa-ellipsis-v"></i>
                  <div className="menu-content">
                    { this.renderEdit(note) }
                    { this.renderStarUnstar(note) }
                    { this.renderMakePublicPrivate(note) }
                    { this.renderTrashUntrash(note) }
                    { this.renderPermanentDelete(note) }
                  </div>
                </div> : null }
            </div>
            { this.renderBody(note) }
          </div>
          <hr className="light" />
          <center className="note-footer">
            A note by&nbsp;
            <a href={ url }>
              { nu.Handle }
            </a>.
          </center>
        </div>
        <Settings />
        <SearchResults onSearchResultSelected={ this.handleSearchResultSelected } />
        <ImportSimpleNote />
        <Editor />
        <TemporaryMessage />
      </div>
      );
  }
}

function appNoteStart() {
  const el = document.getElementById('root');
  ReactDOM.render(<AppNote />, el);
}

window.appNoteStart = appNoteStart;
