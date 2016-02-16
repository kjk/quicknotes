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
    this.handleMakePrivate = this.handleMakePrivate.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.editNote = this.editNote.bind(this);
    this.isMyNote = this.isMyNote.bind(this);

    this.state = {
      note: gInitialNote
    };
  }

  componentDidMount() {
    if (this.isMyNote()) {
      keymaster('ctrl+e', this.editNote);
      keymaster('ctrl+n', () => action.editNewNote());
    }
  }

  componentWillUnmount() {
    if (this.isMyNote()) {
      keymaster.unbind('ctrl+e');
      keymaster.unbind('ctrl+n');
    }
  }

  isMyNote() {
    return gLoggedUser && gLoggedUser.HashID === gNoteUser.HashID;
  }

  editNote() {
    const note = this.state.note;
    action.editNote(note);
  }

  handleSearchResultSelected(noteHashID) {
    console.log('search note selected: ' + noteHashID);
    // TODO: probably should display in-line
    const url = '/n/' + noteHashID;
    const win = window.open(url, '_blank');
    win.focus();
  }

  handleEditNote(e) {
    e.preventDefault();
    const note = this.state.note;
    const id = ni.HashID(note);
    console.log('editNote id: ', id);
    api.getNote(id, json => {
      // TODO: handle error
      action.editNote(json);
    });
  }

  handleMakePrivate(e) {
    console.log('makePrivate');
    e.preventDefault();
  }

  handleDelete(e) {
    console.log('handleDelete');
    e.preventDefault();
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

  render() {
    console.log('appNoteStart: gLoggedUser: ', gLoggedUser);
    const note = this.state.note;
    const title = ni.Title(note);
    const nu = gNoteUser;
    const url = `/u/${nu.HashID}/${nu.Handle}`;
    return (
      <div>
        <div id="note-top">
          <Top />
        </div>
        <div id="full-note">
          <div className="note-content-wrapper">
            <div className="full-note-top">
              <h1>{ title }</h1>
              { this.isMyNote() ?
                <div className="menu-trigger">
                  <i className="fa fa-ellipsis-v"></i>
                  <div className="menu-content">
                    <a href="#" onClick={ this.handleEditNote }>Edit (Ctrl-E)</a>
                    <a href="#" onClick={ this.handleMakePrivate }>Make private</a>
                    <a href="#" onClick={ this.handleDelete }>Move to Trash</a>
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
