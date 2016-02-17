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

    this.handleEditNote = this.handleEditNote.bind(this);
    this.handleMakePublicPrivate = this.handleMakePublicPrivate.bind(this);
    this.handleStarUnstarNote = this.handleStarUnstarNote.bind(this);
    this.handleReloadNotes = this.handleReloadNotes.bind(this);
    this.handleDelUndel = this.handleDelUndel.bind(this);
    this.handlePermanentDelete = this.handlePermanentDelete.bind(this);

    this.editCurrentNote = this.editCurrentNote.bind(this);
    this.isMyNote = this.isMyNote.bind(this);
    this.setNote = this.setNote.bind(this);

    this.state = {
      note: gInitialNote
    };
  }

  componentDidMount() {
    if (this.isMyNote()) {
      keymaster('ctrl+e', this.editCurrentNote);
      keymaster('ctrl+n', () => action.editNewNote());
    }
    action.onReloadNotes(this.handleReloadNotes, this);
  }

  componentWillUnmount() {
    if (this.isMyNote()) {
      keymaster.unbind('ctrl+e');
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
    const hashedNoteID = ni.HashID(note);
    api.getNote(hashedNoteID, note => {
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

  handleMakePublicPrivate(e) {
    const note = this.state.note;
    // console.log('handleMakePublicPrivate, note.IsPublic: ', ni.IsPublic(note));
    const noteId = ni.HashID(note);
    if (ni.IsPublic(note)) {
      api.makeNotePrivate(noteId, note => {
        this.setNote(note);
      });
    } else {
      api.makeNotePublic(noteId, note => {
        this.setNote(note);
      });
    }
  }

  handleStarUnstarNote(e) {
    const note = this.state.note;
    // console.log('handleStarUnstarNote, note.IsStarred: ', ni.IsStarred(note));
    const hashedNoteId = ni.HashID(note);
    if (ni.IsStarred(note)) {
      api.unstarNote(hashedNoteId, note => {
        this.setNote(note);
      });
    } else {
      api.starNote(hashedNoteId, note => {
        this.setNote(note);
      });
    }
  }

  handleDelUndel(e) {
    e.preventDefault();
    const note = this.state.note;
    const hashedNoteId = ni.HashID(note);
    if (ni.IsDeleted(note)) {
      api.undeleteNote(hashedNoteId, note => {
        this.setNote(note);
      });
    } else {
      api.deleteNote(hashedNoteId, note => {
        this.setNote(note);
      });
    }
  }

  handlePermanentDelete(e) {
    e.preventDefault();
    const note = this.state.note;
    const hashedNoteId = ni.HashID(note);
    api.permanentDeleteNote(hashedNoteId, () => {
      // TODO: handle error
      this.setNote(null);
    });
  }

  renderEdit(note) {
    if (ni.IsDeleted(note)) {
      return;
    }
    return <a href="#" onClick={ this.handleEditNote }>Edit (Ctrl-E)</a>;
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
      return <pre dangerouslySetInnerHTML={ html }></pre>;
    }
    const html = {
      __html: toHtml(body)
    };

    return <div dangerouslySetInnerHTML={ html }></div>;
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
      </div>
      );
  }
}

function appNoteStart() {
  const el = document.getElementById('root');
  ReactDOM.render(<AppNote />, el);
}

window.appNoteStart = appNoteStart;
