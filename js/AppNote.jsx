import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import marked from 'marked';
import './linkify.js';
import Top from './Top.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import Editor from './Editor.jsx';
import { escapeHtml } from './utils.js';

const renderer = new marked.Renderer();

const markedOpts = {
  renderer: renderer,
  gfm: true,
  tables: true,
  breaks: true,
  pedantic: false,
  sanitize: true,
  smartLists: true,
  smartypants: false
};

function toHtml(s) {
  s = s.trim();
  const html = marked(s, markedOpts);
  return html;
}

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
  }

  renderBody() {
    const body = gNoteBody;
    const fmtName = gNoteFormat;
    const isTxt = fmtName == 'text';
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
    console.log('appNoteStart: gLoggedInUserHandle: ', gLoggedInUserHandle);
    const isLoggedIn = gLoggedInUserHandle !== '';
    const title = gNoteTitle;
    const noteUser = gNoteUserHandle;
    const url = '/u/' + noteUser;
    return (
      <div>
        <div id="note-top">
          <Top isLoggedIn={ isLoggedIn } loggedInUserHandle={ gLoggedInUserHandle } notesUserHandle="" />
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
              { noteUser }
            </a>.
          </center>
        </div>
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
