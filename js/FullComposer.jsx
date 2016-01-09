import React from 'react';
import ReactDOM from 'react-dom';
import CodeMirrorEditor from './CodeMirrorEditor.jsx';
import * as u from './utils.js';
import * as format from './format.js';
import * as ni from './noteinfo.js';
import _ from 'underscore';

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
  let tags = [];
  const parts = s.split('#');
  parts.forEach(function(part) {
    part = part.trim();
    if (part.length > 0) {
      tags.push(part);
    }
  });
  return tags;
}

export default class FullComposer extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleFormatChanged = this.handleFormatChanged.bind(this);
    this.handlePublicChanged = this.handlePublicChanged.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.handleTagsChanged = this.handleTagsChanged.bind(this);
    this.handleTitleChanged = this.handleTitleChanged.bind(this);
    this.handleTextChanged = this.handleTextChanged.bind(this);

    this.state = {
      note: u.deepCloneObject(props.note),
      previewHtml: ''
    };
  }

  componentDidMount() {
    this.editAreaNode.editor.focus();
    this.updatePreview(ni.Content(this.props.note));
  }

  noteChanged() {
    const n1 = this.props.note;
    const n2 = this.state.note;
    return !ni.notesEq(n1, n2);
  }

  handleSave(e) {
    this.props.saveNoteCb(this.state.note);
  }

  handleCancel(e) {
    this.props.cancelNoteEditCb();
  }

  updatePreview(s) {
    const note = this.state.note;
    if (ni.Format(note) == format.Text) {
      s = '<pre>' + _.escape(s) + '</pre>';
    } else if (ni.Format(note) == format.Markdown) {
      // TODO: call api to convert to html
      s = '<pre>' + _.escape(s) + '</pre>';
    }
    if (s !== this.state.previewHtml) {
      this.setState({
        previewHtml: s
      });
    }
  }

  handleTextChanged(e) {
    let s;
    if (true) {
      // CodeMirror
      s = e;
    } else {
      // textarea
      s = e.target.value;
    }
    s = s.trim();
    const note = u.deepCloneObject(this.state.note);
    ni.SetContent(note, s);
    this.setState({
      note: note
    });
    this.updatePreview(s);
  }

  handlePublicChanged(e) {
    const note = u.deepCloneObject(this.state.note);
    ni.SetPublicState(note, e.target.checked);
    this.setState({
      note: note
    });
  }

  handleTitleChanged(e) {
    const s = e.target.value.trim();
    const note = u.deepCloneObject(this.state.note);
    ni.SetTitle(note, s);
    this.setState({
      note: note
    });
  }

  handleTagsChanged(e) {
    const tagsStr = e.target.value;
    const note = u.deepCloneObject(this.state.note);
    ni.SetTags(note, textToTags(tagsStr));
    this.setState({
      note: note
    });
  }

  handleFormatChanged(e) {
    const formatName = e.target.value;
    const note = u.deepCloneObject(this.state.note);
    ni.SetFormat(note, format.nameToNumber(formatName));
    this.setState({
      note: note
    });
  }

  renderFormatSelect(formats, selected) {
    const options = formats.map(function(format) {
      return <option key={ format }>
               { format }
             </option>;
    });
    return (
      <select value={ selected } onChange={ this.handleFormatChanged }>
        { options }
      </select>
      );
  }

  render() {
    const initialNote = this.props.note;
    const initialTags = tagsToText(ni.Tags(initialNote));
    const note = this.state.note;
    const previewHtml = this.state.previewHtml || '';
    const saveDisabled = !this.noteChanged();
    const formatTxt = format.numberToName(ni.Format(note));
    const formatSelect = this.renderFormatSelect(format.Formats, formatTxt);

    const setEditArea = el => this.editAreaNode = el;
    // TODO: if editing code, change CodeMirror mode property to match code being edited
    return (
      <div id="full-composer-wrapper">
        <div id="full-composer-title">
          <input style={ {  flexGrow: 3} }
            type="text"
            placeholder="Title"
            onChange={ this.handleTitleChanged }
            value={ ni.Title(note) }
            size="128" />
        </div>
        <div id="full-composer-tags">
          <input style={ {  flexGrow: 3} }
            type="text"
            placeholder="Add tag..."
            onChange={ this.handleTagsChanged }
            defaultValue={ initialTags }
            size="128" />
        </div>
        <div id="full-composer-content">
          <CodeMirrorEditor mode="text"
            className="full-composer-editor"
            codeText={ ni.Content(note) }
            value={ ni.Content(note) }
            onChange={ this.handleTextChanged }
            ref={ setEditArea } />
          <div className="full-composer-preview" dangerouslySetInnerHTML={ {  __html: previewHtml} }></div>
        </div>
        <div id="full-composer-actions">
          <div className="inner">
            <button className="btn btn-primary" onClick={ this.handleSave } disabled={ saveDisabled }>
              Save
            </button>
            <button className="btn btn-primary" onClick={ this.handleCancel }>
              Cancel
            </button>
            <input type="checkbox"
              id="public-toggle"
              name="public-toggle"
              onChange={ this.handlePublicChanged }
              checked={ ni.IsPublic(note) }></input>
            <label htmlFor="public-toggle">
              public
            </label>
            <div className="right">
              <span>Format</span>
              { formatSelect }
            </div>
          </div>
        </div>
      </div>
      );
  }
}

FullComposer.propTypes = {
  saveNoteCb: React.PropTypes.func.isRequired,
  cancelNoteEditCb: React.PropTypes.func.isRequired,
  note: React.PropTypes.object
};
