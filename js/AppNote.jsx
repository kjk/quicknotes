import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { toHtml } from './md.js';
import './linkify.js';

import Editor from './Editor.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import SearchResults from './SearchResults.jsx';
import Settings from './Settings.jsx';
import Top from './Top.jsx';

import { escapeHtml } from './utils.js';
import * as ni from './noteinfo.js';

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
  }

  handleSearchResultSelected(noteHashID) {
    console.log('search note selected: ' + noteHashID);
    // TODO: probably should display in-line
    const url = '/n/' + noteHashID;
    const win = window.open(url, '_blank');
    win.focus();
  }

  renderBody() {
    const body = gNoteBody;
    const fmtName = gNoteFormat;
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
    const title = gNoteTitle;
    const nu = gNoteUser;
    const url = `/u/${nu.HashID}/${nu.Handle}`;
    return (
      <div>
        <div id="note-top">
          <Top />
        </div>
        <div id="full-note">
          <div className="note-content-wrapper">
            <h1>{ title }</h1>
            { this.renderBody() }
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
