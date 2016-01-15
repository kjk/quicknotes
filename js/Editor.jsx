import React, { Component, PropTypes } from 'react';
import marked from 'marked';
import CodeMirrorEditor from './CodeMirrorEditor.jsx';
import Overlay from './Overlay.jsx';
import * as action from './action.js';
import * as ni from './noteinfo.js';
import { debounce } from './utils.js';
import * as u from './utils.js';

function getWindowMiddle() {
  const dy = window.innerHeight;
  return dy / 2;
}

function tagsToText(tags) {
  if (!tags) {
    return '';
  }
  let s = '';
  tags.forEach(function(tag) {
    if (s !== '') {
      s += ' ';
    }
    s += '#' + tag;
  });
  return s;
}

function textToTags(s) {
  let tags = s.split('#').map(tag => tag.trim());
  return tags.filter(tag => tag.length == 0);
}

/*
  createNewTextNote(s) {
    const note = {
      Content: s.trim(),
      Format: format.Text
    };
    const noteJSON = JSON.stringify(note);
    api.createOrUpdateNote(noteJSON, () => {
      action.reloadNotes();
    });
  }

  saveNote(note) {
    const newNote = ni.toNewNote(note);
    newNote.Content = newNote.Content.trim();
    const noteJSON = JSON.stringify(newNote);
    u.clearNewNote();

    api.createOrUpdateNote(noteJSON, () => {
      action.reloadNotes();
    });
  }
*/

export default class Editor extends Component {
  constructor(props, context) {
    super(props, context);

    this.toHtml = this.toHtml.bind(this);
    this.editNote = this.editNote.bind(this);
    this.createNewNote = this.createNewNote.bind(this);
    this.handleTextChanged = this.handleTextChanged.bind(this);
    this.handleDiscard = this.handleDiscard.bind(this);
    this.handleEditorCreated = this.handleEditorCreated.bind(this);

    this.initialNote = null;
    this.cm = null;
    this.height = getWindowMiddle();

    this.state = {
      isShowing: false,
      note: null,
      txt: ''
    };
  }

  componentDidMount() {
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
    action.onEditNote(this.editNote, this);
    action.onCreateNewNote(this.createNewNote, this);
  }

  componentWillReceiveProps(nextProps) {
    const cm = this.cm;
    console.log('Editor.componentWillReceiveProps, cm: ', cm);
    if (!cm) {
      return;
    }
    /*cm.focus();*/
    cm.execCommand('goDocEnd');
    cm.scrollIntoView();
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  handleTextChanged(e) {
    const s = e.target.value;
    this.setState({
      txt: s
    });
  }

  handleDiscard(e) {
    this.setState({
      isShowing: false,
      txt: ''
    });
  }

  handleEditorCreated(cm) {
    this.cm = cm;
  }

  editNote(note) {
    console.log('Editor.editNote: note=', note);
    note = u.deepCloneObject(note);

    this.initialNote = u.deepCloneObject(note);
    let s = ni.FetchContent(note, () => {
      this.setState({
        txt: ni.Content(note)
      });
    });
    s = s || '';
    this.setState({
      note: note,
      txt: s,
      isShowing: true
    });
  }

  createNewNote() {
    console.log('Editor.createNewNote');
    // TODO: create empty default note with empty id
    //this.editAreaNode.editor.focus();
    this.setState({
      note: null,
      isShowing: true
    });
  }

  toHtml(s) {
    s = s.trim();
    const html = marked(s);
    return html;
  }

  renderMarkdownButtons() {
    console.log('renderMarkdownButtons');
    return (
      <div id="editor-button-bar" className="flex-row">
        <button className="ebtn no-text" title="Strong (⌘B)">
          <i className="fa fa-bold"></i>
        </button>
        <button className="ebtn no-text" title="Emphasis (⌘I)">
          <i className="fa fa-italic"></i>
        </button>
        <div className="editor-spacer"></div>
        <button className="ebtn no-text" title="Hyperlink (⌘K)">
          <i className="fa fa-link"></i>
        </button>
        <button className="ebtn no-text" title="Blockquote (⌘⇧9)">
          <i className="fa fa-quote-right"></i>
        </button>
        <button className="ebtn no-text" title="Preformatted text (⌘⇧C)">
          <i className="fa fa-code"></i>
        </button>
        <button className="ebtn no-text" title="Upload">
          <i className="fa fa-upload"></i>
        </button>
        <div className="editor-spacer"></div>
        <button className="ebtn no-text" title="Bulleted List (⌘⇧8)">
          <i className="fa fa-list-ul"></i>
        </button>
        <button className="ebtn no-text" title="Numbered List (⌘⇧7)">
          <i className="fa fa-list-ol"></i>
        </button>
        <button className="ebtn no-text" title="Heading (⌘⌥1)">
          <i className="fa fa-font"></i>
        </button>
        <button className="ebtn no-text" title="Horizontal Rule (⌘⌥R)">
          <i className="fa fa-minus"></i>
        </button>
      </div>
      );
  }

  noteHasChanged() {
    const n1 = this.initialNote;
    const n2 = this.state.note;
    return !ni.notesEq(n1, n2);
  }

  renderMarkdownWithPreview() {
    const mode = 'text';
    const s = this.state.txt;
    console.log('renderMarkdownPreview: s=', s);
    const html = {
      __html: this.toHtml(s)
    };

    const setEditArea = el => this.editAreaNode = el;
    const style1 = {
      display: 'inline-block',
      paddingTop: 8
    };

    const style = {
      height: this.height
    };

    const saveDisabled = true;

    return (
      <Overlay>
        <div id="editor-wrapper" className="flex-col" style={ style }>
          <div className="drag-bar-vert"></div>
          <div id="editor-top" className="flex-row">
            <input id="editor-title" className="editor-input half" placeholder="title goes here...">
            </input>
            <input id="editor-tags" className="editor-input half" placeholder="#enter #tags">
            </input>
          </div>
          <div id="editor-text-with-preview" className="flex-row">
            <div id="editor-preview-with-buttons" className="flex-col">
              { this.renderMarkdownButtons() }
              <CodeMirrorEditor mode={ mode }
                className="editor-textarea-wrap"
                textAreaClassName="editor-textarea"
                placeholder="Enter text here..."
                value={ s }
                autofocus
                onChange={ this.handleTextChanged }
                onEditorCreated={ this.handleEditorCreated }
                ref={ setEditArea } />
            </div>
            <div id="editor-preview" dangerouslySetInnerHTML={ html }></div>
          </div>
          <div id="editor-bottom" className="flex-row">
            <div>
              <button className="btn btn-primary" disabled={ saveDisabled }>
                Save
              </button>
              <button className="btn btn-primary" onClick={ this.handleDiscard }>
                Discard
              </button>
              <div style={ style1 }>
                <span>Format:</span>
                <span className="drop-down-init">markdown <i className="fa fa-angle-down"></i></span>
              </div>
            </div>
            <div id="editor-hide-preview">
              <span>hide preview</span>
            </div>
          </div>
        </div>
      </Overlay>
      );
  }

  render() {
    console.log('Editor.render, isShowing:', this.state.isShowing, 'height:', this.height);

    if (!this.state.isShowing) {
      return <div className="hidden"></div>;
    }

    return this.renderMarkdownWithPreview();
  }
}
