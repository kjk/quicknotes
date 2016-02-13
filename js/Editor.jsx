'use strict';

import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import keymaster from 'keymaster';
import CodeMirrorEditor from './CodeMirrorEditor.jsx';

import Overlay from './Overlay.jsx';
import DragBarHoriz from './DragBarHoriz.jsx';
import TextSelect from './TextSelect.jsx';

import * as action from './action.js';
import * as ni from './noteinfo.js';
import { debounce } from './utils.js';
import { toHtml } from './md.js';
import { isUndefined, deepCloneObject, strArrRemoveDups } from './utils.js';
import * as api from './api.js';

// https://github.com/musicbed/MirrorMark/blob/master/src/js/mirrormark.js
// https://github.com/NextStepWebs/simplemde-markdown-editor/blob/master/src/js/simplemde.js
// https://github.com/lepture/editor

const kDragBarDy = 11;

const cmOptions = {
  'autofocus': true
};

function formatPrettyName(fmt) {
  if (fmt === ni.formatText) {
    return 'text';
  }
  if (fmt === ni.formatMarkdown) {
    return 'markdown';
  }
  return fmt;
}

function formatShortName(fmt) {
  if (fmt === 'text') {
    return ni.formatText;
  }
  if (fmt === 'markdown') {
    return ni.formatMarkdown;
  }
  return fmt;
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
  return strArrRemoveDups(tags);
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
    return this.formatName === ni.formatText;
  }

  isMarkdown() {
    return this.formatName === ni.formatMarkdown;
  }
}

function noteFromCompact(noteCompact, body) {
  const id = ni.HashID(noteCompact);
  const title = ni.Title(noteCompact);
  const tags = ni.Tags(noteCompact);
  const tagsStr = tagsToText(tags);
  const isPublic = ni.IsPublic(noteCompact);
  const formatName = ni.Format(noteCompact);
  return new Note(id, title, tagsStr, body, isPublic, formatName);
}

/* convert Note note to
type NewNoteFromBrowser struct {
	HashID   string
	Title    string
	Format   int
	Content  string
	Tags     []string
	IsPublic bool
}
*/
function toNewNoteJSON(note) {
  var n = {};
  n.HashID = note.id;
  n.Title = note.title;
  n.Format = note.formatName;
  n.Content = note.body.trim() + '\n';
  n.Tags = textToTags(note.tags);
  n.IsPublic = note.isPublic;
  return JSON.stringify(n);
}

function newEmptyNote() {
  return new Note(null, '', '', '', false, ni.formatMarkdown);
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

var insertTexts = {
  link: ['[', '](http://)'],
  image: ['![](http://', ')'],
  table: ['', '\n\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Text     | Text      | Text     |\n\n'],
  horizontalRule: ['', '\n\n-----\n\n']
};

var blockStyles = {
  'bold': '**',
  'italic': '*'
};

// The state of CodeMirror at the given position.
function getState(cm, pos) {
  pos = pos || cm.getCursor('start');
  var stat = cm.getTokenAt(pos);
  if (!stat.type) return {};

  var types = stat.type.split(' ');

  var ret = {},
    data, text;
  for (var i = 0; i < types.length; i++) {
    data = types[i];
    if (data === 'strong') {
      ret.bold = true;
    } else if (data === 'variable-2') {
      text = cm.getLine(pos.line);
      if (/^\s*\d+\.\s/.test(text)) {
        ret['ordered-list'] = true;
      } else {
        ret['unordered-list'] = true;
      }
    } else if (data === 'atom') {
      ret.quote = true;
    } else if (data === 'em') {
      ret.italic = true;
    } else if (data === 'quote') {
      ret.quote = true;
    } else if (data === 'strikethrough') {
      ret.strikethrough = true;
    } else if (data === 'comment') {
      ret.code = true;
    }
  }
  return ret;
}

function _replaceSelection(cm, active, startEnd) {
  var text;
  var start = startEnd[0];
  var end = startEnd[1];
  var startPoint = cm.getCursor('start');
  var endPoint = cm.getCursor('end');
  if (active) {
    text = cm.getLine(startPoint.line);
    start = text.slice(0, startPoint.ch);
    end = text.slice(startPoint.ch);
    cm.replaceRange(start + end, {
      line: startPoint.line,
      ch: 0
    });
  } else {
    text = cm.getSelection();
    cm.replaceSelection(start + text + end);

    startPoint.ch += start.length;
    if (startPoint !== endPoint) {
      endPoint.ch += start.length;
    }
  }
  cm.setSelection(startPoint, endPoint);
  cm.focus();
}

function _toggleHeading(cm, direction, size) {
  var startPoint = cm.getCursor('start');
  var endPoint = cm.getCursor('end');
  for (var i = startPoint.line; i <= endPoint.line; i++) {
    (function(i) {
      var text = cm.getLine(i);
      var currHeadingLevel = text.search(/[^#]/);

      if (isUndefined(direction)) {
        if (currHeadingLevel <= 0) {
          if (direction == 'bigger') {
            text = '###### ' + text;
          } else {
            text = '# ' + text;
          }
        } else if (currHeadingLevel == 6 && direction == 'smaller') {
          text = text.substr(7);
        } else if (currHeadingLevel == 1 && direction == 'bigger') {
          text = text.substr(2);
        } else {
          if (direction == 'bigger') {
            text = text.substr(1);
          } else {
            text = '#' + text;
          }
        }
      } else {
        if (size == 1) {
          if (currHeadingLevel <= 0) {
            text = '# ' + text;
          } else if (currHeadingLevel == size) {
            text = text.substr(currHeadingLevel + 1);
          } else {
            text = '# ' + text.substr(currHeadingLevel + 1);
          }
        } else if (size == 2) {
          if (currHeadingLevel <= 0) {
            text = '## ' + text;
          } else if (currHeadingLevel == size) {
            text = text.substr(currHeadingLevel + 1);
          } else {
            text = '## ' + text.substr(currHeadingLevel + 1);
          }
        } else {
          if (currHeadingLevel <= 0) {
            text = '### ' + text;
          } else if (currHeadingLevel == size) {
            text = text.substr(currHeadingLevel + 1);
          } else {
            text = '### ' + text.substr(currHeadingLevel + 1);
          }
        }
      }

      cm.replaceRange(text, {
        line: i,
        ch: 0
      }, {
        line: i,
        ch: 99999999999999
      });
    })(i);
  }
  cm.focus();
}

function _toggleLine(cm, name) {
  var stat = getState(cm);
  var startPoint = cm.getCursor('start');
  var endPoint = cm.getCursor('end');
  var repl = {
    'quote': /^(\s*)\>\s+/,
    'unordered-list': /^(\s*)(\*|\-|\+)\s+/,
    'ordered-list': /^(\s*)\d+\.\s+/
  };
  var map = {
    'quote': '> ',
    'unordered-list': '* ',
    'ordered-list': '1. '
  };
  for (var i = startPoint.line; i <= endPoint.line; i++) {
    (function(i) {
      var text = cm.getLine(i);
      if (stat[name]) {
        text = text.replace(repl[name], '$1');
      } else {
        text = map[name] + text;
      }
      cm.replaceRange(text, {
        line: i,
        ch: 0
      }, {
        line: i,
        ch: 99999999999999
      });
    })(i);
  }
  cm.focus();
}

function _toggleBlock(cm, type, start_chars, end_chars) {
  end_chars = isUndefined(end_chars) ? start_chars : end_chars;
  var stat = getState(cm);

  var text;
  var start = start_chars;
  var end = end_chars;

  var startPoint = cm.getCursor('start');
  var endPoint = cm.getCursor('end');

  if (stat[type]) {
    text = cm.getLine(startPoint.line);
    start = text.slice(0, startPoint.ch);
    end = text.slice(startPoint.ch);
    if (type == 'bold') {
      start = start.replace(/(\*\*|__)(?![\s\S]*(\*\*|__))/, '');
      end = end.replace(/(\*\*|__)/, '');
    } else if (type == 'italic') {
      start = start.replace(/(\*|_)(?![\s\S]*(\*|_))/, '');
      end = end.replace(/(\*|_)/, '');
    } else if (type == 'strikethrough') {
      start = start.replace(/(\*\*|~~)(?![\s\S]*(\*\*|~~))/, '');
      end = end.replace(/(\*\*|~~)/, '');
    }
    cm.replaceRange(start + end, {
      line: startPoint.line,
      ch: 0
    }, {
      line: startPoint.line,
      ch: 99999999999999
    });

    if (type == 'bold' || type == 'strikethrough') {
      startPoint.ch -= 2;
      if (startPoint !== endPoint) {
        endPoint.ch -= 2;
      }
    } else if (type == 'italic') {
      startPoint.ch -= 1;
      if (startPoint !== endPoint) {
        endPoint.ch -= 1;
      }
    }
  } else {
    text = cm.getSelection();
    if (type == 'bold') {
      text = text.split('**').join('');
      text = text.split('__').join('');
    } else if (type == 'italic') {
      text = text.split('*').join('');
      text = text.split('_').join('');
    } else if (type == 'strikethrough') {
      text = text.split('~~').join('');
    }
    cm.replaceSelection(start + text + end);

    startPoint.ch += start_chars.length;
    endPoint.ch = startPoint.ch + text.length;
  }

  cm.setSelection(startPoint, endPoint);
  cm.focus();
}

function toggleBold(cm) {
  _toggleBlock(cm, 'bold', '**');
}

function toggleItalic(cm) {
  _toggleBlock(cm, 'italic', '*');
}

function toggleBlockquote(cm) {
  _toggleLine(cm, 'quote');
}

function toggleUnorderedList(cm) {
  _toggleLine(cm, 'unordered-list');
}

function toggleOrderedList(cm) {
  _toggleLine(cm, 'ordered-list');
}

function toggleHeadingSmaller(cm) {
  _toggleHeading(cm, 'smaller');
}

function toggleHeadingBigger(cm) {
  _toggleHeading(cm, 'bigger');
}

function toggleCodeBlock(cm) {
  _toggleBlock(cm, 'code', '```\r\n', '\r\n```');
}

function drawHorizontalRule(cm) {
  var stat = getState(cm);
  _replaceSelection(cm, stat.image, insertTexts.horizontalRule);
}

function drawLink(cm) {
  var stat = getState(cm);
  _replaceSelection(cm, stat.link, insertTexts.link);
}

function drawImage(cm) {
  var stat = getState(cm);
  _replaceSelection(cm, stat.image, insertTexts.image);
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
    this.handleEditCmdImage = this.handleEditCmdImage.bind(this);
    this.handleEditCmdItalic = this.handleEditCmdItalic.bind(this);
    this.handleEditCmdLink = this.handleEditCmdLink.bind(this);
    this.handleEditCmdQuote = this.handleEditCmdQuote.bind(this);
    this.handleEditCmdCode = this.handleEditCmdCode.bind(this);
    this.handleEditCmdListUnordered = this.handleEditCmdListUnordered.bind(this);
    this.handleEditCmdListOrdered = this.handleEditCmdListOrdered.bind(this);
    this.handleEditCmdHeading = this.handleEditCmdHeading.bind(this);
    this.handleEditCmdHr = this.handleEditCmdHr.bind(this);

    this.editNewNote = this.editNewNote.bind(this);
    this.ctrlEnterPressed = this.ctrlEnterPressed.bind(this);
    this.editNote = this.editNote.bind(this);
    this.escPressed = this.escPressed.bind(this);
    this.scheduleTimer = this.scheduleTimer.bind(this);
    this.startEditingNote = this.startEditingNote.bind(this);
    this.updateCodeMirrorMode = this.updateCodeMirrorMode.bind(this);

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

  handleTextChanged(cm) {
    const s = cm.getValue();
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

  updateCodeMirrorMode() {
    if (!this.cm) {
      return;
    }
    const note = this.state.note;
    let mode = 'text';
    if (note.isText()) {
      mode = 'text';
    } else if (note.isMarkdown()) {
      mode = 'markdown';
    }
    this.cm.setOption('mode', mode);
    // console.log('updateCodeMirrorMode: mode=', mode);
  }

  handleEditorCreated(cm) {
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
    this.updateCodeMirrorMode();
  }

  startEditingNote(note) {
    this.firstRender = true;
    this.initialNote = deepCloneObject(note);
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

  editNote(noteCompactInitial) {
    //console.log('Editor.editNote: noteCompact=', noteCompact);
    ni.FetchLatestContent(noteCompactInitial, (noteCompact, body) => {
      const note = noteFromCompact(noteCompact, body);
      this.startEditingNote(note);
    });
  }

  handleEditCmdBold(e) {
    toggleBold(this.cm);
  }

  handleEditCmdItalic(e) {
    toggleItalic(this.cm);
  }

  handleEditCmdLink(e) {
    drawLink(this.cm);
  }

  handleEditCmdQuote(e) {
    toggleBlockquote(this.cm);
  }

  handleEditCmdCode(e) {
    toggleCodeBlock(this.cm);
  }

  handleEditCmdListUnordered(e) {
    toggleUnorderedList(this.cm);
  }

  handleEditCmdListOrdered(e) {
    toggleOrderedList(this.cm);
  }

  handleEditCmdHeading(e) {
    toggleHeadingSmaller(this.cm);
  }

  handleEditCmdHr(e) {
    drawHorizontalRule(this.cm);
  }

  handleEditCmdImage(e) {
    drawImage(this.cm);
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

  handleFormatChanged(e, valIdx, val) {
    let note = this.state.note;
    note.formatName = formatShortName(val);
    this.setFocusInUpdate = true;
    this.setState({
      note: note
    });
  }

  handlePublicOrPrivateChanged(e, valIdx, v) {
    let note = this.state.note;
    note.isPublic = valIdx == 0;
    this.setFocusInUpdate = true;
    this.setState({
      note: note
    });
  }

  renderPublicOrPrivateSelect(isPublic) {
    const values = ['public', 'private'];
    const selectedIdx = isPublic ? 0 : 1;

    return (
      <TextSelect values={ values } selectedIdx={ selectedIdx } onChange={ this.handlePublicOrPrivateChanged } />
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

  renderFormatSelect(formatSelected) {
    const formats = ['text', 'markdown'];
    const formatPretty = formatPrettyName(formatSelected);
    const selectedIdx = formats.indexOf(formatPretty);
    return (
      <TextSelect values={ formats } selectedIdx={ selectedIdx } onChange={ this.handleFormatChanged } />
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
        <button className="btn" onClick={ this.handleEditCmdHeading } title="Heading (⌘⌥1)">
          <i className="fa fa-header"></i>
        </button>
        <div className="editor-spacer"></div>
        <button className="btn" onClick={ this.handleEditCmdQuote } title="Blockquote (⌘⇧9)">
          <i className="fa fa-quote-right"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdCode } title="Preformatted text (⌘⇧C)">
          <i className="fa fa-code"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdListUnordered } title="Bulleted List (⌘⇧8)">
          <i className="fa fa-list-ul"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdListOrdered } title="Numbered List (⌘⇧7)">
          <i className="fa fa-list-ol"></i>
        </button>
        <div className="editor-spacer"></div>
        <button className="btn" onClick={ this.handleEditCmdLink } title="Hyperlink (⌘K)">
          <i className="fa fa-link"></i>
        </button>
        <button className="btn" onClick={ this.handleEditCmdImage } title="Insert Image (Ctrl+Alt+I)">
          <i className="fa fa-picture-o"></i>
        </button>
      </div>
      );
  }

  renderBottom(note) {
    const saveDisabled = !didNoteChange(note, this.initialNote);
    const formatSelect = this.renderFormatSelect(note.formatName);
    const publicSelect = this.renderPublicOrPrivateSelect(note.isPublic);
    return (
      <div id="editor-bottom" className="flex-row">
        <button className="btn btn-primary" disabled={ saveDisabled } onClick={ this.handleSave }>
          Save
        </button>
        <button className="btn btn-cancel" onClick={ this.handleCancel }>
          Cancel
        </button>
        A
        { publicSelect },
        { formatSelect }&nbsp;note.
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
            <CodeMirrorEditor className="codemirror-div"
              textAreaClassName="cm-textarea"
              placeholder="Enter text here..."
              defaultValue={ note.body }
              cmOptions={ cmOptions }
              onChange={ this.handleTextChanged }
              onEditorCreated={ this.handleEditorCreated } />
          </div>
          { bottom }
        </div>
      </Overlay>
      );
  }

  renderEditorMarkdownNoPreview() {
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
            <CodeMirrorEditor className="codemirror-div"
              textAreaClassName="cm-textarea"
              placeholder="Enter text here..."
              defaultValue={ note.body }
              cmOptions={ cmOptions }
              onChange={ this.handleTextChanged }
              onEditorCreated={ this.handleEditorCreated } />
          </div>
          { bottom }
        </div>
      </Overlay>
      );
  }

  renderEditorMarkdownWithPreview() {
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
                <CodeMirrorEditor className="codemirror-div"
                  textAreaClassName="cm-textarea"
                  placeholder="Enter text here..."
                  defaultValue={ note.body }
                  cmOptions={ cmOptions }
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
    console.log('Editor.render, isShowing:', this.state.isShowing, 'top:', this.top);

    if (!this.state.isShowing) {
      return <div className="hidden"></div>;
    }
    this.updateCodeMirrorMode();
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
