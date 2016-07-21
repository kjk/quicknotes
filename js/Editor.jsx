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
import { focusSearch, isUndefined, deepCloneObject, strArrRemoveDups } from './utils.js';
import * as api from './api.js';

// https://github.com/musicbed/MirrorMark/blob/master/src/js/mirrormark.js
// https://github.com/NextStepWebs/simplemde-markdown-editor/blob/master/src/js/simplemde.js
// https://github.com/lepture/editor

const kDragBarDy = 6;
const kDragBarMin = 64;

const isMac = /Mac/.test(navigator.platform);

const cmOptions = {
  //'autofocus': true,
  'lineWrapping': true,
  'lineNumbers': false,
  'tabSize': 2,
  'tabindex': 3
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

  isEmpty() {
    return this.title == '' && this.tags == '' && this.body == '';
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
    data,
    text;
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

      if (!isUndefined(direction)) {
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

function fixShortcut(name) {
  if (isMac) {
    name = name.replace('Ctrl', 'Cmd');
  } else {
    name = name.replace('Cmd', 'Ctrl');
  }
  return name;
}

function getCodeMirrorState(cm) {
  return {
    cursor: cm.getCursor(),
    selections: cm.listSelections()
  };
}

function restoreCodeMirrorState(cm, state) {
  if (state) {
    cm.setSelections(state.selections);
    cm.setCursor(state.cursor);
  }
}

// https://github.com/NextStepWebs/simplemde-markdown-editor/blob/master/src/js/simplemde.js#L749
const wordCountPattern = /[a-zA-Z0-9_\u0392-\u03c9]+|[\u4E00-\u9FFF\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\uac00-\ud7af]+/g;

/* The right word count in respect for CJK. */
function wordCount(data) {
  const m = data.match(wordCountPattern);
  if (m === null) {
    return 0;
  }
  let count = 0;
  for (let i = 0; i < m.length; i++) {
    if (m[i].charCodeAt(0) >= 0x4E00) {
      count += m[i].length;
    } else {
      count += 1;
    }
  }
  return count;
}

function isNullMsg(o) {
  if (isUndefined(o) || o == null) {
    return 'is null';
  }
  return 'not null';
}

export default class Editor extends Component {
  constructor(props, context) {
    super(props, context);

    this.handleCancel = this.handleCancel.bind(this);
    this.handleDragBarMoved = this.handleDragBarMoved.bind(this);
    this.handleEditorCreated = this.handleEditorCreated.bind(this);
    this.handleFormatChanged = this.handleFormatChanged.bind(this);
    this.handleHidePreview = this.handleHidePreview.bind(this);
    this.handleOpenInNewWindow = this.handleOpenInNewWindow.bind(this);
    this.handlePublicOrPrivateChanged = this.handlePublicOrPrivateChanged.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.handleShowPreview = this.handleShowPreview.bind(this);
    this.handleTogglePreview = this.handleTogglePreview.bind(this);
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

    this.ctrlEnterPressed = this.ctrlEnterPressed.bind(this);
    this.editNewNote = this.editNewNote.bind(this);
    this.editNote = this.editNote.bind(this);
    this.escPressed = this.escPressed.bind(this);
    this.isShowingPreview = this.isShowingPreview.bind(this);
    this.scheduleTimer = this.scheduleTimer.bind(this);
    this.setupCodeMirror = this.setupCodeMirror.bind(this);
    this.setupScrollSync = this.setupScrollSync.bind(this);
    this.startEditingNote = this.startEditingNote.bind(this);
    this.togglePreview = this.togglePreview.bind(this);
    this.updateCodeMirrorMode = this.updateCodeMirrorMode.bind(this);

    this.initialNote = null;
    this.cm = null;
    this.top = getWindowMiddle();
    this.firstRender = true;
    this.isNewCM = false;
    this.setFocusInUpdate = false;
    this.savedCodeMirrorState = null;

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
    keymaster('F9', this.togglePreview);
    keymaster('ctrl+enter', this.ctrlEnterPressed);

    this.scheduleTimer();
  }

  componentDidUpdate() {
    const cm = this.cm;
    // console.log('Editor.componentDidUpdate, cm ', isNullMsg(cm));
    if (!cm) {
      return;
    }

    if (this.setFocusInUpdate) {
      this.cm.focus();
      this.setFocusInUpdate = false;
    }

    if (this.isNewCM) {
      this.isNewCM = false;
      this.setupCodeMirror();
      this.setupScrollSync();
    }

    if (!this.firstRender) {
      restoreCodeMirrorState(cm, this.savedCodeMirrorState);
      this.savedCodeMirrorState = null;
      return;
    }

    // special handling if this is first render for this note
    this.firstRender = false;
    // for new (empty) notes, focus in title
    if (this.state.note.isEmpty()) {
      const node = ReactDOM.findDOMNode(this.refs.title);
      node.focus();
      return;
    }

    // for existing notes, focus in tbe editor
    cm.execCommand('goDocStart'); // goDocEnd
    cm.scrollIntoView();
    cm.focus();
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
    keymaster.unbind('esc');
    keymaster.unbind('f9');
    keymaster.unbind('ctrl+enter');
  }

  handleEditorCreated(cm) {
    // console.log('Editor.handleEditorCreated');
    this.cm = cm;
    this.isNewCM = true;
  }

  // https://github.com/NextStepWebs/simplemde-markdown-editor/blob/master/src/js/simplemde.js#L1267
  setupScrollSync() {
    const cm = this.cm;
    if (!cm) {
      return;
    }
    if (!this.isShowingPreview()) {
      return;
    }
    const preview = ReactDOM.findDOMNode(this.refs.preview);

    // Syncs scroll  editor -> preview
    var cScroll = false;
    var pScroll = false;
    cm.on('scroll', v => {
      if (!this.isShowingPreview()) {
        return;
      }
      if (cScroll) {
        cScroll = false;
        return;
      }
      pScroll = true;
      // console.log('editor scroll, preview:', preview);
      var height = v.getScrollInfo().height - v.getScrollInfo().clientHeight;
      var ratio = parseFloat(v.getScrollInfo().top) / height;
      var move = (preview.scrollHeight - preview.clientHeight) * ratio;
      preview.scrollTop = move;
    });

    // Syncs scroll  preview -> editor
    preview.onscroll = function() {
      if (pScroll) {
        pScroll = false;
        return;
      }
      cScroll = true;
      var height = preview.scrollHeight - preview.clientHeight;
      var ratio = parseFloat(preview.scrollTop) / height;
      var move = (cm.getScrollInfo().height - cm.getScrollInfo().clientHeight) * ratio;
      cm.scrollTo(0, move);
    };
  }

  setupCodeMirror() {
    const cm = this.cm;

    const shortcuts = {
      'Ctrl-B': cm => toggleBold(cm),
      'Ctrl-I': cm => toggleItalic(cm),
      'Ctrl-K': cm => drawLink(cm),
      'Cmd-H': cm => toggleHeadingSmaller(cm),
      'F9': cm => this.togglePreview(),
      "Cmd-'": cm => toggleBlockquote(cm),
      'Ctrl-L': cm => toggleUnorderedList(cm),
      'Cmd-Alt-L': cm => toggleOrderedList(cm),
      'Shift-Cmd-H': cm => toggleHeadingBigger(cm),
      'Enter': 'newlineAndIndentContinueMarkdownList'
    };

    let extraKeys = {};
    Object.keys(shortcuts).forEach(k => {
      const k2 = fixShortcut(k);
      extraKeys[k2] = shortcuts[k];
    });

    extraKeys['Ctrl-Enter'] = this.ctrlEnterPressed;
    if (isMac) {
      extraKeys['Cmd-Enter'] = this.ctrlEnterPressed;
    }

    cm.setOption('extraKeys', extraKeys);
    this.updateCodeMirrorMode();
  }

  ctrlEnterPressed() {
    // console.log('ctrlEnterPressed');
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
      focusSearch();
      return false;
    }
    if (!didNoteChange(this.initialNote, this.state.note)) {
      this.setState({
        isShowing: false,
        note: newEmptyNote()
      });
    }
    return false;
  }

  handleDragBarMoved(y) {
    // console.log('Editor.handleDragBarMoved: y=', y);
    this.top = y;
    const node = ReactDOM.findDOMNode(this.refs.editorWrapper);
    if (node) {
      // console.log('this.refs.editorWrapper=', node);
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
    this.setState({
      isShowing: false,
      note: newEmptyNote()
    });
    action.showTemporaryMessage('Saving note...', 500);
    const isNewNote = note.id;
    api.createOrUpdateNote(noteJSON, res => {
      // TODO: handle error
      let hashID = '';
      if (res) {
        hashID = res.HashID;
      }
      let msg = isNewNote ? `Updated <a href="/n/${hashID}" target="_blank">the note</a>.` : `Created <a href="/n/${hashID}" target="_blank">the note</a>.`;
      action.showTemporaryMessage(msg);
      action.reloadNotes(false);
    });
  }

  handleCancel(e) {
    this.setState({
      isShowing: false,
      note: newEmptyNote()
    });
  }

  updateCodeMirrorMode() {
    const note = this.state.note;
    let mode = 'text';
    if (note.isText()) {
      mode = 'text';
    } else if (note.isMarkdown()) {
      mode = 'markdown';
    }
    if (!this.cm) {
      console.log('updteCodeMirrorMode but this.cm is null');
      return;
    }
    this.cm.setOption('mode', mode);
  // console.log('updateCodeMirrorMode: mode=', mode);
  }

  isShowingPreview() {
    const state = this.state;
    return state.note.isMarkdown() && state.isShowingPreview;
  }

  startEditingNote(note) {
    // at this point we might not be rendered yet, so we use variables
    // to communicate with componentDidUpdate
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
    const node = ReactDOM.findDOMNode(this.refs.editorTextAreaWrapper);
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
    this.savedCodeMirrorState = getCodeMirrorState(this.cm);
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

  togglePreview() {
    // console.log('togglePreview');
    const note = this.state.note;
    // can be invoked via F9 inside editor but only applicable
    // if note is markdown
    if (!note.isMarkdown()) {
      return;
    }
    this.setFocusInUpdate = true;
    this.savedCodeMirrorState = getCodeMirrorState(this.cm);
    const isShowing = !this.state.isShowingPreview;
    this.setState({
      isShowingPreview: isShowing
    });
  }

  handleTogglePreview(e) {
    e.preventDefault();
    this.togglePreview();
  }

  handleOpenInNewWindow(e) {
    e.preventDefault();
  }

  renderFormatSelect(formatSelected) {
    const formats = ['text', 'markdown'];
    const formatPretty = formatPrettyName(formatSelected);
    const selectedIdx = formats.indexOf(formatPretty);
    return (
      <TextSelect values={ formats } selectedIdx={ selectedIdx } onChange={ this.handleFormatChanged } />
      );
  }

  renderMarkdownButtons(isText) {
    if (isText) {
      return;
    }
    // TODO: translate shortcuts for Windows
    return (
      <div id='editor-buttons' className='flex-row'>
        <button className='ebtn hint--bottom' onClick={ this.handleEditCmdBold } data-hint='Bold (⌘B)'>
          <i className='fa fa-bold'></i>
        </button>
        <button className='ebtn hint--bottom' onClick={ this.handleEditCmdItalic } data-hint='Italic (⌘I)'>
          <i className='fa fa-italic'></i>
        </button>
        <button className='ebtn hint--bottom' onClick={ this.handleEditCmdHeading } data-hint='Heading (⌘H)'>
          <i className='fa fa-header'></i>
        </button>
        <div className='editor-btn-spacer'></div>
        <button className='ebtn hint--bottom' onClick={ this.handleEditCmdQuote } data-hint="Blockquote (⌘-')">
          <i className='fa fa-quote-right'></i>
        </button>
        <button className='ebtn hint--bottom' onClick={ this.handleEditCmdCode } data-hint='Code block'>
          <i className='fa fa-code'></i>
        </button>
        <button className='ebtn hint--bottom' onClick={ this.handleEditCmdListUnordered } data-hint='Bulleted List (Ctrl-L)'>
          <i className='fa fa-list-ul'></i>
        </button>
        <button className='ebtn hint--bottom' onClick={ this.handleEditCmdListOrdered } data-hint='Numbered List (⌘-Alt-L'>
          <i className='fa fa-list-ol'></i>
        </button>
        <div className='editor-btn-spacer'></div>
        <button className='ebtn hint--bottom' onClick={ this.handleEditCmdLink } data-hint='Link (Ctrl-K)'>
          <i className='fa fa-link'></i>
        </button>
        <button className='ebtn hint--bottom' onClick={ this.handleEditCmdImage } data-hint='Image'>
          <i className='fa fa-picture-o'></i>
        </button>
        <div className='editor-btn-spacer'></div>
        <button className='ebtn hint--bottom' onClick={ this.handleTogglePreview } data-hint='Toggle Preview (F9)'>
          <i className='fa fa-columns'></i>
        </button>
      </div>
      );
  }

  render() {
    // console.log('Editor.render, isShowing:', this.state.isShowing, 'top:', this.top);

    if (!this.state.isShowing) {
      return <div className='hidden'></div>;
    }

    const note = this.state.note;
    const isText = note.isText();
    const isShowingPreview = this.state.isShowingPreview;

    const styleFormat = {
      display: 'inline-block',
      paddingTop: 8,
    };

    const y = this.top;
    const dragBarMax = window.innerHeight - 320;

    const saveDisabled = !didNoteChange(note, this.initialNote);
    const formatSelect = this.renderFormatSelect(note.formatName);
    const publicSelect = this.renderPublicOrPrivateSelect(note.isPublic);
    let editor;
    if (isText || !isShowingPreview) {
      const style = {
        width: '100%',
        flexGrow: 8,
        borderTop: '1px solid lightgray'
      };
      editor = (
        <div id='cm-wrapper' ref='editorTextAreaWrapper' style={ style }>
          <CodeMirrorEditor className='codemirror-div'
            textAreaClassName='cm-textarea'
            placeholder='Enter text here...'
            defaultValue={ note.body }
            cmOptions={ cmOptions }
            onChange={ this.handleTextChanged }
            onEditorCreated={ this.handleEditorCreated } />
        </div>
      );
    } else {
      const html = {
        __html: toHtml(note.body)
      };

      editor = (
        <div id='editor-text-with-preview' className='flex-row'>
          <div id='cm-wrapper' ref='editorTextAreaWrapper'>
            <CodeMirrorEditor className='codemirror-div'
              textAreaClassName='cm-textarea'
              placeholder='Enter text here...'
              defaultValue={ note.body }
              cmOptions={ cmOptions }
              onChange={ this.handleTextChanged }
              onEditorCreated={ this.handleEditorCreated } />
          </div>
          <div id='editor-preview' ref='preview'>
            <div id='editor-preview-inner' dangerouslySetInnerHTML={ html }></div>
          </div>
        </div>
      );
    }

    const style = {
      height: editorHeight(y)
    };

    /*
                <button className="ebtn" onClick={ this.handleOpenInNewWindow } title="Open in New Window">
                  <i className="fa fa-expand"></i>
                </button>
    */

    return (
      <Overlay>
        <DragBarHoriz initialY={ y }
          dy={ kDragBarDy }
          min={ kDragBarMin }
          max={ dragBarMax }
          onPosChanged={ this.handleDragBarMoved } />
        <div id='editor-wrapper'
          className='flex-col'
          style={ style }
          ref='editorWrapper'>
          <div id='editor-top' className='flex-row'>
            <button className='btn btn-primary hint--bottom'
              disabled={ saveDisabled }
              onClick={ this.handleSave }
              data-hint='Ctrl-Enter'>
              Save
            </button>
            <button className='btn btn-cancel' onClick={ this.handleCancel }>
              Cancel
            </button>
            { publicSelect }
            { formatSelect }
            <input id='editor-title'
              className='editor-input'
              placeholder='title here...'
              value={ note.title }
              onChange={ this.handleTitleChanged }
              ref='title'
              tabIndex='1' />
            <input id='editor-tags'
              className='editor-input'
              placeholder='#enter #tags'
              value={ note.tags }
              onChange={ this.handleTagsChanged }
              tabIndex='2' />
            <div className='editor-spacer2'></div>
          </div>
          { this.renderMarkdownButtons(isText) }
          { editor }
        </div>
      </Overlay>
      );
  }

}
