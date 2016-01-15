import React, { Component, PropTypes } from 'react';
import marked from 'marked';
import CodeMirrorEditor from './CodeMirrorEditor.jsx';
import Overlay from './Overlay.jsx';
import DragBarHoriz from './DragBarHoriz.jsx';
import * as action from './action.js';
import * as ni from './noteinfo.js';
import { debounce } from './utils.js';
import * as u from './utils.js';

const kDragBarDy = 11;

function getWindowMiddle() {
  const dy = window.innerHeight;
  return dy / 3;
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

function editorHeight(y) {
  return window.innerHeight - y - kDragBarDy;
}

export default class Editor extends Component {
  constructor(props, context) {
    super(props, context);

    this.toHtml = this.toHtml.bind(this);
    this.editNote = this.editNote.bind(this);
    this.createNewNote = this.createNewNote.bind(this);
    this.handleTextChanged = this.handleTextChanged.bind(this);
    this.handleDiscard = this.handleDiscard.bind(this);
    this.handleEditorCreated = this.handleEditorCreated.bind(this);
    this.handleDragBarMoved = this.handleDragBarMoved.bind(this);
    this.handleTimer = this.handleTimer.bind(this);
    this.scheduleTimer = this.scheduleTimer.bind(this);

    this.initialNote = null;
    this.cm = null;
    this.top = getWindowMiddle();

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

    this.scheduleTimer();
  }

  componentDidUpdate() {
    const cm = this.cm;
    console.log('Editor.componentDidUpdate, cm: ', cm);
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

  handleDragBarMoved(y) {
    //console.log('Editor.handleDragBarMoved: y=', y, 'height=', height);
    this.top = y;
    this.editorWrapperNode.style.height = editorHeight(y) + 'px';
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
    return (
      <div id="editor-button-bar" className="flex-row">
        <button className="btn" title="Strong (⌘B)">
          <i className="fa fa-bold"></i>
        </button>
        <button className="btn" title="Emphasis (⌘I)">
          <i className="fa fa-italic"></i>
        </button>
        <div className="editor-spacer"></div>
        <button className="btn" title="Hyperlink (⌘K)">
          <i className="fa fa-link"></i>
        </button>
        <button className="btn" title="Blockquote (⌘⇧9)">
          <i className="fa fa-quote-right"></i>
        </button>
        <button className="btn" title="Preformatted text (⌘⇧C)">
          <i className="fa fa-code"></i>
        </button>
        <button className="btn" title="Upload">
          <i className="fa fa-upload"></i>
        </button>
        <div className="editor-spacer"></div>
        <button className="btn" title="Bulleted List (⌘⇧8)">
          <i className="fa fa-list-ul"></i>
        </button>
        <button className="btn" title="Numbered List (⌘⇧7)">
          <i className="fa fa-list-ol"></i>
        </button>
        <button className="btn" title="Heading (⌘⌥1)">
          <i className="fa fa-font"></i>
        </button>
        <button className="btn" title="Horizontal Rule (⌘⌥R)">
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

  scheduleTimer() {
    setTimeout(() => {
      this.handleTimer();
    }, 100);
  }

  handleTimer() {
    if (!this.state.isShowing) {
      this.scheduleTimer();
      return;
    }
    const node = this.editorTextAreaWrapperNode;
    const h = node.clientHeight;
    //console.log('h=', h);

    const els = document.getElementsByClassName('codemirror-div');
    //console.log('el: ', els);
    els.item(0).style.height = h + 'px';
    //this.cm.setSize(null, h);
    this.scheduleTimer();
  }

  renderMarkdownWithPreview() {
    const mode = 'text';
    const s = this.state.txt;
    const html = {
      __html: this.toHtml(s)
    };

    const styleFormat = {
      display: 'inline-block',
      paddingTop: 8,
    };

    const y = this.top;
    const dragBarStyle = {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: window.innerHeight - y - kDragBarDy,
      //width: '100%',
      cursor: 'row-resize',
      height: kDragBarDy,
      zIndex: 20, // higher than overlay
      overflow: 'hidden',
      background: 'url(/s/img/grippie-d28a6f65e22c0033dcf0d63883bcc590.png) white no-repeat center 3px'
    };

    const dragBarMax = window.innerHeight - 320;
    const dragBarMin = 64;

    const style = {
      height: editorHeight(y)
    };

    const saveDisabled = true;

    const setEditorWrapperNode = node => this.editorWrapperNode = node;
    const setEditorTextAreaWrapperNode = node => this.editorTextAreaWrapperNode = node;
    const setCodemirrorDivNode = node => this.codeMirrorDivNode = node;

    return (
      <Overlay>
        <DragBarHoriz style={ dragBarStyle }
          initialY={ y }
          min={ dragBarMin }
          max={ dragBarMax }
          onPosChanged={ this.handleDragBarMoved } />
        <div id="editor-wrapper"
          className="flex-col"
          style={ style }
          ref={ setEditorWrapperNode }>
          <div id="editor-top" className="flex-row">
            <input id="editor-title" className="editor-input" placeholder="title goes here...">
            </input>
            <input id="editor-tags" className="editor-input" placeholder="#enter #tags">
            </input>
          </div>
          <div id="editor-text-with-preview" className="flex-row">
            <div id="editor-preview-with-buttons" className="flex-col">
              { this.renderMarkdownButtons() }
              <div id="cm-wrapper" ref={ setEditorTextAreaWrapperNode }>
                <CodeMirrorEditor mode={ mode }
                  className="codemirror-div"
                  textAreaClassName="cm-textarea"
                  placeholder="Enter text here..."
                  value={ s }
                  autofocus
                  onChange={ this.handleTextChanged }
                  onEditorCreated={ this.handleEditorCreated }
                  ref={ setCodemirrorDivNode } />
              </div>
            </div>
            <div id="editor-preview">
              <div id="editor-preview-inner" dangerouslySetInnerHTML={ html }></div>
            </div>
          </div>
          <div id="editor-bottom" className="flex-row">
            <div>
              <button className="btn btn-primary" disabled={ saveDisabled }>
                Save
              </button>
              <button className="btn btn-primary" onClick={ this.handleDiscard }>
                Discard
              </button>
              <div style={ styleFormat }>
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
    //console.log('Editor.render, isShowing:', this.state.isShowing, 'top:', this.top);

    if (!this.state.isShowing) {
      return <div className="hidden"></div>;
    }

    return this.renderMarkdownWithPreview();
  }
}
