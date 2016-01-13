import React, { Component, PropTypes } from 'react';
import marked from 'marked';
import CodeMirrorEditor from './CodeMirrorEditor.jsx';
import * as action from './action.js';
import { debounce } from './utils.js';

function getWindowMiddle() {
  const dy = window.innerHeight;
  return dy / 2;
}

export default class EditorNew extends Component {
  constructor(props, context) {
    super(props, context);

    this.toggleEditor = this.toggleEditor.bind(this);
    this.toHtml = this.toHtml.bind(this);
    this.editNote = this.editNote.bind(this);
    this.createNewNote = this.createNewNote.bind(this);

    this.handleTextChanged = debounce(s => {
      this.setState({
        txt: s
      })
    }, 250);

    this.height = getWindowMiddle();
    this.state = {
      isShowing: true,
      note: null,
      txt: "initial text"
    };
  }

  componentDidMount() {
    this.editAreaNode.editor.focus();
    marked.setOptions({
      renderer: new marked.Renderer(),
      gfm: true,
      tables: true,
      breaks: true,
      pedantic: false,
      sanitize: true,
      smartLists: true,
      smartypants: false
    });
    action.onToggleEditor(this.toggleEditor, this);
    action.onEditNote(this.editNote, this);
    action.onCreateNewNote(this.createNewNote, this);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  editNote(note) {
    console.log("EditorNew.editNote: note=", note);
    this.setState({
      note: note,
      isShowing: true
    })
  }

  createNewNote() {
    console.log("EditorNew.createNewNote: note=", note);
    // TODO: create empty default note with empty id
    this.setState({
      note: null,
      isShowing: true
    })
  }

  toggleEditor() {
    this.height = getWindowMiddle();
    this.setState({
      isShowing: !this.state.isShowing
    });
  }

  toHtml(s) {
    s = s.trim();
    const html = marked(s);
    return html;
  }

  render() {
    console.log('EditorNew.render, isShowing:', this.state.isShowing, 'height:', this.height);

    if (!this.state.isShowing) {
      return <div className="hidden"></div>;
    }

    const style = {
      height: this.height
    };

    const setEditArea = el => this.editAreaNode = el;
    const mode = 'text';
    const s = this.state.txt;
    const html = {
      __html: this.toHtml(s)
    };
    return (
      <div style={ style } id="editor-control">
        <div id="editor-text-preview-wrapper">
          <div id="editor-text-area-wrapper">
            <CodeMirrorEditor mode={ mode }
              className="editor-text-area"
              codeText={ s }
              value={ s }
              onChange={ this.handleTextChanged}
              ref={ setEditArea } />
          </div>
          <div id="editor-preview-area" dangerouslySetInnerHTML={ html }>
          </div>
        </div>
        <div id="editor-bottom">
          <button>
            Save
          </button>
          <button>
            Cancel
          </button>
        </div>
      </div>
      );
  }
}
