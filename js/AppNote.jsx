import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import marked from 'marked';

import Top from './Top.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import Editor from './Editor.jsx';

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

export default class AppNote extends Component {
  constructor(props, context) {
    super(props, context);
  }

  renderBody() {
    const body = gNoteBody;
    const fmtName = gNoteFormat;
    const isTxt = fmtName == 'text';
    if (isTxt) {
      return <pre><b>not markdown</b>: { body }</pre>;
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
          <center className="dimmed">
            A note by
            <a href="/u/{noteUser}">
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
