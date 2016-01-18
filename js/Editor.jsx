import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import marked from 'marked';
import keymaster from 'keymaster';
import CodeMirrorEditor from './CodeMirrorEditor.jsx';

import Overlay from './Overlay.jsx';
import DragBarHoriz from './DragBarHoriz.jsx';
import * as action from './action.js';
import * as ni from './noteinfo.js';
import { debounce } from './utils.js';
import * as u from './utils.js';
import * as format from './format.js';
import * as api from './api.js';

// https://github.com/musicbed/MirrorMark/blob/master/src/js/mirrormark.js

const kDragBarDy = 11;

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

// like https://github.com/chjj/marked/blob/master/lib/marked.js#L869
// but adds target="_blank"
renderer.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase();
    } catch (e) {
      return '';
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
      return '';
    }
  }
  var out = '<a href="' + href + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += 'target="_blank"';
  out += '>' + text + '</a>';
  return out;
};

function toHtml(s) {
  s = s.trim();
  const html = marked(s, markedOpts);
  return html;
}

function getWindowMiddle() {
  const dy = window.innerHeight;
  return dy / 3;
}

function tagsToText(tags) {
  if (!tags) {
    return '';
  }
  let s = '';
  tags.forEach(tag => {
    if (s !== '') {
      s += ' ';
    }
    s += '#' + tag;
  });
  return s;
}

function textToTags(s) {
  let tags = [];
  s.split(' ').forEach(tag => {
    tag = tag.trim();
    if (tag.startsWith('#')) {
      tag = tag.substring(1);
    }
    if (tag.length > 0) {
      tags.push(tag);
    }
  });
  return u.strArrRemoveDups(tags);
}

function editorHeight(y) {
  return window.innerHeight - y - kDragBarDy;
}

class Note {
  constructor(id, title, tags, body, isPublic, formatName) {
    this.id = id;
    this.title = title;
    this.tags = tags;
    this.body = body;
    this.isPublic = isPublic;
    this.formatName = formatName;
  }
  isText() {
    return format.IdFromName(this.formatName) == format.TextId;
  }
  isMarkdown() {
    return format.IdFromName(this.foramtName) == format.MarkdownId;
  }
}

function noteFromCompact(noteCompact) {
  const id = ni.IDStr(noteCompact);
  const title = ni.Title(noteCompact);
  const tags = ni.Tags(noteCompact);
  const tagsStr = tagsToText(tags);
  const body = ni.Content(noteCompact);
  const isPublic = ni.IsPublic(noteCompact);
  const formatId = ni.Format(noteCompact);
  const formatName = format.NameFromId(formatId);
  return new Note(id, title, tagsStr, body, isPublic, formatName);
}

/* convert Note note to
type NewNoteFromBrowser struct {
	IDStr    string
	Title    string
	Format   int
	Content  string
	Tags     []string
	IsPublic bool
}
*/
function toNewNoteJSON(note) {
  var n = {};
  n.IDStr = note.id;
  n.Title = note.title;
  n.Format = format.IdFromName(note.formatName);
  n.Content = note.body.trim() + '\n';
  n.Tags = textToTags(note.tags);
  n.IsPublic = note.isPublic;
  return JSON.stringify(n);
}

function newEmptyNote() {
  return new Note(null, '', '', '', false, format.MarkdownName);
}

function didNoteChange(n1, n2) {
  if (n1.title != n2.title) {
    return true;
  }
  if (n1.tags != n2.tags) {
    return true;
  }
  if (n1.body != n2.body) {
    return true;
  }
  if (n1.isPublic != n2.isPublic) {
    return true;
  }
  if (n1.formatName != n2.formatName) {
    return true;
  }
  return false;
}

export default class Editor extends Component {
  constructor(props, context) {
    super(props, context);

    this.handleCancel = this.handleCancel.bind(this);
    this.handleDragBarMoved = this.handleDragBarMoved.bind(this);
    this.handleEditorCreated = this.handleEditorCreated.bind(this);
    this.handleFormatChanged = this.handleFormatChanged.bind(this);
    this.handleHidePreview = this.handleHidePreview.bind(this);
    this.handlePublicOrPrivateChanged = this.handlePublicOrPrivateChanged.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.handleShowPreview = this.handleShowPreview.bind(this);
    this.handleTagsChanged = this.handleTagsChanged.bind(this);
    this.handleTextChanged = this.handleTextChanged.bind(this);
    this.handleTimer = this.handleTimer.bind(this);
    this.handleTitleChanged = this.handleTitleChanged.bind(this);

    this.handleEditCmdBold = this.handleEditCmdBold.bind(this);
    this.handleEditCmdItalic = this.handleEditCmdItalic.bind(this);
    this.handleEditCmdLink = this.handleEditCmdLink.bind(this);
    this.handleEditCmdQuote = this.handleEditCmdQuote.bind(this);
    this.handleEditCmdCode = this.handleEditCmdCode.bind(this);
    this.handleEditCmdListUnordered = this.handleEditCmdListUnordered.bind(this);
    this.handleEditCmdListOrdered = this.handleEditCmdListOrdered.bind(this);
    this.handleEditCmdHeading = this.handleEditCmdHeading.bind(this);
    this.handleEditCmdHr = this.handleEditCmdHr.bind(this);

    this.cmInsertAround = this.cmInsertAround.bind(this);
    this.cmInsertBefore = this.cmInsertBefore.bind(this);
    this.cmInsert = this.cmInsert.bind(this);

    this.editNewNote = this.editNewNote.bind(this);
    this.ctrlEnterPressed = this.ctrlEnterPressed.bind(this);
    this.editNote = this.editNote.bind(this);
    this.escPressed = this.escPressed.bind(this);
    this.scheduleTimer = this.scheduleTimer.bind(this);
    this.startEditingNote = this.startEditingNote.bind(this);

    this.initialNote = null;
    this.cm = null;
    this.top = getWindowMiddle();
    this.firstRender = true;

    this.setFocusInUpdate = false;
    this.state = {
      isShowing: false,
      isShowingPreview: true,
      note: null,
    };
  }

  componentDidMount() {
    action.onEditNote(this.editNote, this);
    action.onEditNewNote(this.editNewNote, this);
    keymaster('esc', this.escPressed);

    this.scheduleTimer();
  }

  componentDidUpdate() {
    const cm = this.cm;
    //console.log('Editor.componentDidUpdate, cm: ', cm);
    if (!cm) {
      return;
    }
    if (this.setFocusInUpdate) {
      this.cm.focus();
      this.setFocusInUpdate = false;
    }
    if (!this.firstRender) {
      return;
    }
    this.firstRender = false;
    /*cm.focus();*/
    cm.execCommand('goDocEnd');
    cm.scrollIntoView();
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
    keymaster.unbind('esc');
  }

  ctrlEnterPressed() {
    console.log('ctrlEnterPressed');
    if (!this.state.isShowing) {
      return;
    }
    if (!didNoteChange(this.initialNote, this.state.note)) {
      return;
    }
    this.handleSave();
  }

  escPressed() {
    if (!this.state.isShowing) {
      return;
    }
    if (!didNoteChange(this.initialNote, this.state.note)) {
      this.setState({
        isShowing: false,
        note: newEmptyNote()
      });
    }
  }

  handleDragBarMoved(y) {
    console.log('Editor.handleDragBarMoved: y=', y);
    this.top = y;
    const node = ReactDOM.findDOMNode(this.refs.editorWrapperNode);
    if (node) {
      console.log('this.refs.editorWrapperNode=', node);
      node.style.height = editorHeight(y) + 'px';
      this.cm.refresh();
    }
  }

  handleTextChanged(e) {
    const s = e.target.value;
    let note = this.state.note;
    note.body = s;
    this.setState({
      note: note
    });
  }

  handleTitleChanged(e) {
    const s = e.target.value;
    let note = this.state.note;
    note.title = s;
    this.setState({
      note: note
    });
  }

  handleTagsChanged(e) {
    const s = e.target.value;
    let note = this.state.note;
    note.tags = s;
    this.setState({
      note: note
    });
  }

  handleSave(e) {
    const note = this.state.note;
    const noteJSON = toNewNoteJSON(note);
    //console.log('handleSave, note=', note, 'noteJSON=', noteJSON);
    api.createOrUpdateNote(noteJSON, () => {
      this.setState({
        isShowing: false,
        note: newEmptyNote()
      });
      action.reloadNotes();
    });
  }

  handleCancel(e) {
    this.setState({
      isShowing: false,
      note: newEmptyNote()
    });
  }

  handleEditorCreated(cm) {
    console.log('handleEditorCreated');
    this.cm = cm;
    cm.setOption('extraKeys', {
      'Ctrl-Enter': cm => {
        this.ctrlEnterPressed();
      },
      'Cmd-Enter': cm => {
        this.ctrlEnterPressed();
      },
      'Enter': 'newlineAndIndentContinueMarkdownList'
    });

    cm.setOption('lineWrapping', true);
    cm.setOption('lineNumbers', true);
    cm.setOption('tabSize', 2);
  }

  startEditingNote(note) {
    this.firstRender = true;
    this.initialNote = u.deepCloneObject(note);
    this.setState({
      isShowing: true,
      note: note
    });
  }

  editNewNote() {
    if (this.state.isShowing) {
      //console.log('Editor.editNewNote: skipping because already editing');
      return;
    }
    this.startEditingNote(newEmptyNote());
  }

  editNote(noteCompact) {
    //console.log('Editor.editNote: noteCompact=', noteCompact);
    let s = ni.FetchContent(noteCompact, () => {
      const note = noteFromCompact(noteCompact);
      this.startEditingNote(note);
    });
    if (s !== null) {
      const note = noteFromCompact(noteCompact);
      this.startEditingNote(note);
    }
  }

  cmInsertAround(start, end) {
    this.cm.focus();

    const doc = this.cm.getDoc();
    const cursor = doc.getCursor();

    if (doc.somethingSelected()) {
      const selection = doc.getSelection();
      doc.replaceSelection(start + selection + end);
    } else {
      // If no selection then insert start and end args and set cursor position between the two.
      doc.replaceRange(start + end, {
        line: cursor.line,
        ch: cursor.ch
      });
      doc.setCursor({
        line: cursor.line,
        ch: cursor.ch + start.length
      });
    }
  }

  cmInsertBefore(insertion, cursorOffset) {
    this.cm.focus();
    const doc = this.cm.getDoc();
    const cursor = doc.getCursor();

    if (doc.somethingSelected()) {
      const selections = doc.listSelections();
      selections.forEach(function(selection) {
        const pos = [selection.head.line, selection.anchor.line].sort();
        for (let i = pos[0]; i <= pos[1]; i++) {
          doc.replaceRange(insertion, {
            line: i,
            ch: 0
          });
        }
        doc.setCursor({
          line: pos[0],
          ch: cursorOffset || 0
        });
      });
    } else {
      doc.replaceRange(insertion, {
        line: cursor.line,
        ch: 0
      });
      doc.setCursor({
        line: cursor.line,
        ch: cursorOffset || 0
      });
    }
  }

  cmInsert(s) {
    this.cm.focus();
    const doc = this.cm.getDoc();
    const cursor = doc.getCursor();
    doc.replaceRange(s, {
      line: cursor.line,
      ch: cursor.ch
    });
  }

  handleEditCmdBold(e) {
    e.preventDefault();
    console.log('editCmdBold');
    this.cmInsertAround('**', '**');
  }

  handleEditCmdItalic(e) {
    e.preventDefault();
    console.log('editCmdItalic');
    this.cmInsertAround('*', '*');
  }

  handleEditCmdLink(e) {
    e.preventDefault();
    console.log('editCmdLink');
    this.cmInsertAround('[', '](http://)');
  }

  handleEditCmdQuote(e) {
    e.preventDefault();
    console.log('editCmdQuote');
    this.cmInsertBefore('> ', 2);
  }

  handleEditCmdCode(e) {
    e.preventDefault();
    console.log('editCmdCode');
    this.cmInsertAround('```\r\n', '\r\n```');
  }

  handleEditCmdListUnordered(e) {
    e.preventDefault();
    console.log('editCmdListUnordered');
    this.cmInsertBefore('* ', 2);
  }

  handleEditCmdListOrdered(e) {
    e.preventDefault();
    console.log('editCmdListOrdered');
    this.cmInsertBefore('1. ', 3);
  }

  handleEditCmdHeading(e) {
    e.preventDefault();
    console.log('editCmdHeading');
  }

  handleEditCmdHr(e) {
    e.preventDefault();
    console.log('editCmdHr');
    this.cmInsert('---');
  }

  handleEditCmdImage(e) {
    e.preventDefault();
    this.cmInsertBefore('![](http://)', 2);
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
    const node = ReactDOM.findDOMNode(this.refs.editorTextAreaWrapperNode);
    // if the node we monitor for size changes doesn't exist yet,
    // skip dependent updates but check back later
    if (!node) {
      this.scheduleTimer();
      return;
    }

    const h = node.clientHeight;
    //console.log('h=', h);

    const els = document.getElementsByClassName('codemirror-div');
    //console.log('el: ', els);
    const n = els.length;
    for (let i = 0; i < n; i++) {
      els.item(i).style.height = h + 'px';
    }
    this.cm.refresh();
    this.scheduleTimer();
  }

  handleFormatChanged(e) {
    const v = e.target.value;
    let note = this.state.note;
    note.formatName = v;
    this.setFocusInUpdate = true;
    this.setState({
      note: note
    });
  }

  handlePublicOrPrivateChanged(e) {
    const v = e.target.value;
    let note = this.state.note;
    note.isPublic = v == 'public';
    this.setFocusInUpdate = true;
    this.setState({
      note: note
    });
  }

  renderPublicOrPrivateSelect(isPublic) {
    const style = {
      marginLeft: 8,
      width: 108
    };
    const values = ['public', 'private'];
    const selected = isPublic ? values[0] : values[1];

    const options = values.map(v => {
      return <option key={ v } value={ v }>
               { v }
             </option>;
    });
    return (
      <div className="editor-select-wrapper" style={ style }>
        <select value={ selected } onChange={ this.handlePublicOrPrivateChanged }>
          { options }
        </select>
        <span></span>
      </div>
      );
  }

  handleHidePreview(e) {
    e.preventDefault();
    this.setState({
      isShowingPreview: false
    });
  }

  handleShowPreview(e) {
    e.preventDefault();
    this.setState({
      isShowingPreview: true
    });
  }

  renderFormatSelect(formats, selected) {
    const style = {
      marginLeft: 8,
      marginRight: 16,
      width: 108
    };

    const options = formats.map(function(format) {
      return <option key={ format } value={ format }>
               { format }
             </option>;
    });
    return (
      <div className="editor-select-wrapper" style={ style }>
        <select value={ selected } onChange={ this.handleFormatChanged }>
          { options }
        </select>
        <span></span>
      </div>
      );
  }

  renderShowHidePreview(note) {
    if (note.isText()) {
      return;
    }
    if (this.state.isShowingPreview) {
      return <a className="editor-hide-show-preview" href="#" onClick={ this.handleHidePreview }>« hide preview</a>;
    } else {
      return <a className="editor-hide-show-preview" href="#" onClick={ this.handleShowPreview }>show preview »</a>;
    }
  }

  renderMarkdownButtons() {
    return (
      <div id="editor-button-bar" className="flex-row">
        <button className="btn" onClick={ this.handleEditCmdBold } title="Strong (⌘B)">
          <i className="fa fa-bold"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdItalic } title="Emphasis (⌘I)">
          <i className="fa fa-italic"></i>
        </button>
        <div className="editor-spacer"></div>
        <button className="btn" onClick={ this.handleEditCmdLink } title="Hyperlink (⌘K)">
          <i className="fa fa-link"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdQuote } title="Blockquote (⌘⇧9)">
          <i className="fa fa-quote-right"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdCode } title="Preformatted text (⌘⇧C)">
          <i className="fa fa-code"></i>
        </button>
        <div className="editor-spacer"></div>
        <button className="btn" onClick={ this.handleEditCmdListUnordered } title="Bulleted List (⌘⇧8)">
          <i className="fa fa-list-ul"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdListOrdered } title="Numbered List (⌘⇧7)">
          <i className="fa fa-list-ol"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdHeading } title="Heading (⌘⌥1)">
          <i className="fa fa-font"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdHr } title="Horizontal Rule (⌘⌥R)">
          <i className="fa fa-minus"></i>
        </button>
      </div>
      );
  }

  renderBottom(note) {
    const saveDisabled = !didNoteChange(note, this.initialNote);
    const formatSelect = this.renderFormatSelect(format.FormatNames, note.formatName);
    const publicSelect = this.renderPublicOrPrivateSelect(note.isPublic);
    return (
      <div id="editor-bottom" className="flex-row">
        <button className="btn btn-primary" disabled={ saveDisabled } onClick={ this.handleSave }>
          Save
        </button>
        <button className="btn btn-primary" onClick={ this.handleCancel }>
          Cancel
        </button>
        <div>
          Format:
        </div>
        { formatSelect }
        <div>
          Visibility:
        </div>
        { publicSelect }
        <div className="flex-spacer">
          &nbsp;
        </div>
        { this.renderShowHidePreview(note) }
      </div>
      );
  }

  renderEditorText() {
    const mode = 'text';
    const note = this.state.note;

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
      background: 'url(/s/img/grippie-d28a6f65e22c0033dcf0d63883bcc590.png) white no-repeat center 3px',
      backgroundColor: '#f0f0f0'
    };

    const dragBarMax = window.innerHeight - 320;
    const dragBarMin = 64;

    const style = {
      height: editorHeight(y)
    };

    const bottom = this.renderBottom(note);

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
          ref="editorWrapperNode">
          <div id="editor-top" className="flex-row">
            <input id="editor-title"
              className="editor-input"
              placeholder="title goes here..."
              value={ note.title }
              onChange={ this.handleTitleChanged } />
            <input id="editor-tags"
              className="editor-input"
              placeholder="#enter #tags"
              value={ note.tags }
              onChange={ this.handleTagsChanged } />
          </div>
          <div id="cm-wrapper" ref="editorTextAreaWrapperNode">
            <CodeMirrorEditor mode={ mode }
              className="codemirror-div"
              textAreaClassName="cm-textarea"
              placeholder="Enter text here..."
              value={ note.body }
              autofocus
              onChange={ this.handleTextChanged }
              onEditorCreated={ this.handleEditorCreated } />
          </div>
          { bottom }
        </div>
      </Overlay>
      );
  }

  renderEditorMarkdownNoPreview() {
    const mode = 'text';
    const note = this.state.note;

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
      background: 'url(/s/img/grippie-d28a6f65e22c0033dcf0d63883bcc590.png) white no-repeat center 3px',
      backgroundColor: '#f0f0f0'
    };

    const dragBarMax = window.innerHeight - 320;
    const dragBarMin = 64;

    const style = {
      height: editorHeight(y)
    };

    const bottom = this.renderBottom(note);

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
          ref="editorWrapperNode">
          <div id="editor-top" className="flex-row">
            <input id="editor-title"
              className="editor-input"
              placeholder="title goes here..."
              value={ note.title }
              onChange={ this.handleTitleChanged } />
            <input id="editor-tags"
              className="editor-input"
              placeholder="#enter #tags"
              value={ note.tags }
              onChange={ this.handleTagsChanged } />
          </div>
          { this.renderMarkdownButtons() }
          <div id="cm-wrapper" ref="editorTextAreaWrapperNode">
            <CodeMirrorEditor mode={ mode }
              className="codemirror-div"
              textAreaClassName="cm-textarea"
              placeholder="Enter text here..."
              value={ note.body }
              autofocus
              onChange={ this.handleTextChanged }
              onEditorCreated={ this.handleEditorCreated } />
          </div>
          { bottom }
        </div>
      </Overlay>
      );
  }

  renderEditorMarkdownWithPreview() {
    const mode = 'text';
    const note = this.state.note;
    const html = {
      __html: toHtml(note.body)
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
      background: 'url(/s/img/grippie-d28a6f65e22c0033dcf0d63883bcc590.png) white no-repeat center 3px',
      backgroundColor: '#f0f0f0'
    };

    const dragBarMax = window.innerHeight - 320;
    const dragBarMin = 64;

    const style = {
      height: editorHeight(y)
    };

    const bottom = this.renderBottom(note);

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
          ref="editorWrapperNode">
          <div id="editor-top" className="flex-row">
            <input id="editor-title"
              className="editor-input"
              placeholder="title goes here..."
              value={ note.title }
              onChange={ this.handleTitleChanged } />
            <input id="editor-tags"
              className="editor-input"
              placeholder="#enter #tags"
              value={ note.tags }
              onChange={ this.handleTagsChanged } />
          </div>
          <div id="editor-text-with-preview" className="flex-row">
            <div id="editor-preview-with-buttons" className="flex-col">
              { this.renderMarkdownButtons() }
              <div id="cm-wrapper" ref="editorTextAreaWrapperNode">
                <CodeMirrorEditor mode={ mode }
                  className="codemirror-div"
                  textAreaClassName="cm-textarea"
                  placeholder="Enter text here..."
                  value={ note.body }
                  autofocus
                  onChange={ this.handleTextChanged }
                  onEditorCreated={ this.handleEditorCreated } />
              </div>
            </div>
            <div id="editor-preview">
              <div id="editor-preview-inner" dangerouslySetInnerHTML={ html }></div>
            </div>
          </div>
          { bottom }
        </div>
      </Overlay>
      );
  }

  render() {
    //console.log('Editor.render, isShowing:', this.state.isShowing, 'top:', this.top);

    if (!this.state.isShowing) {
      return <div className="hidden"></div>;
    }
    const note = this.state.note;
    if (note.isText()) {
      return this.renderEditorText();
    }
    if (this.state.isShowingPreview) {
      return this.renderEditorMarkdownWithPreview();
    } else {
      return this.renderEditorMarkdownNoPreview();
    }
  }
}
