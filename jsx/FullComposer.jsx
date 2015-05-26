/* jshint -W097,-W117 */
'use strict';

var CodeMirrorEditor = require('./CodeMirrorEditor.jsx');
var utils = require('./utils.js');
var format = require('./format.js');
var ni = require('./noteinfo.js');
var _ = require('./underscore.js');

function tagsToText(tags) {
  if (!tags) {
    return "";
  }
  var s = "";
  tags.forEach(function(tag) {
    if (s !== "") {
      s += " ";
    }
    s += "#" + tag;
  });
  return s;
}

function textToTags(s) {
  var tags = [];
  var parts = s.split("#");
  parts.forEach(function(part) {
    part = part.trim();
    if (part.length > 0) {
      tags.push(part);
    }
  });
  return tags;
}

var FullComposer = React.createClass({
  getInitialState: function() {
    return {
      note: utils.deepCloneObject(this.props.note),
      previewHtml: ""
    };
  },

  noteChanged: function() {
    var n1 = this.props.note;
    var n2 = this.state.note;
    return !ni.notesEq(n1, n2);
  },

  handleSave: function(e) {
    this.props.saveNoteCb(this.state.note);
  },

  handleCancel: function(e) {
    this.props.cancelNoteEditCb();
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.editArea);
    // TODO: this doesn't work
    el.focus();
    this.updatePreview(ni.Content(this.props.note));
  },

  updatePreview: function(s) {
    var note = this.state.note;
    if (ni.Format(note) == format.Text) {
      s = "<pre>" + _.escape(s) + "</pre>";
    } else if (ni.Format(note) == format.Markdown) {
      // TODO: call api to convert to html
      s = "<pre>" + _.escape(s) + "</pre>";
    }
    if (s !== this.state.previewHtml) {
      this.setState({
        previewHtml: s
      });
    }
  },

  textChanged: function(e) {
    var s;
    if (true) {
      // CodeMirror
      s = e;
    } else {
      // textarea
      s = e.target.value;
    }
    s = s.trim();
    var note = utils.deepCloneObject(this.state.note);
    ni.SetContent(note, s);
    this.setState({
      note: note
    });
    this.updatePreview(s);
  },

  handlePublicChanged: function(e) {
    var note = utils.deepCloneObject(this.state.note);
    ni.SetPublicState(note, e.target.checked);
    this.setState({
      note: note
    });
  },

  handleTitleChanged: function(e) {
    var s = e.target.value.trim();
    var note = utils.deepCloneObject(this.state.note);
    ni.SetTitle(note, s);
    this.setState({
      note: note
    });
  },

  handleTagsChanged: function(e) {
    var tagsStr = e.target.value;
    var note = utils.deepCloneObject(this.state.note);
    ni.SetTags(note, textToTags(tagsStr));
    this.setState({
      note: note
    });
  },

  handleFormatChanged: function(e) {
    var formatName = e.target.value;
    var note = utils.deepCloneObject(this.state.note);
    ni.SetFormat(note, format.nameToNumber(formatName));
    this.setState({
      note: note
    });
  },

  renderFormatSelect: function(formats, selected) {
    var options = formats.map(function(format) {
      return <option key={format}>{format}</option>;
    });
    return (
      <select value={selected} onChange={this.handleFormatChanged}>{options}</select>
    );
  },

  render: function() {
    var initialNote = this.props.note;
    var initialTags = tagsToText(ni.Tags(initialNote));
    var note = this.state.note;
    var previewHtml = { __html: this.state.previewHtml };
    var saveDisabled = !this.noteChanged();
    var formatTxt = format.numberToName(ni.Format(note));
    var formatSelect = this.renderFormatSelect(format.Formats, formatTxt);

    // TODO: if editing code, change CodeMirror mode property to match code being edited
    return (
      <div id="full-composer-wrapper">
        <div id="full-composer-title">
          <input
            style={{flexGrow: 3}}
            type="text"
            placeholder="Title"
            onChange={this.handleTitleChanged}
            value={ni.Title(note)} size="128"/>
        </div>

        <div id="full-composer-tags">
          <input
            style={{flexGrow: 3}}
            type="text"
            placeholder="Add tag..."
            onChange={this.handleTagsChanged}
            defaultValue={initialTags}
            size="128"/>
        </div>

        <div id="full-composer-content">
          <CodeMirrorEditor
            mode="text"
            className="full-composer-editor"
            codeText={ni.Content(note)}
            value={ni.Content(note)}
            onChange={this.textChanged}
            ref="editArea" />
          <div className="full-composer-preview" dangerouslySetInnerHTML={previewHtml}></div>
        </div>
        <div id="full-composer-actions">
          <div className="inner">
            <button onClick={this.handleSave} disabled={saveDisabled}>Save</button>
            <button onClick={this.handleCancel}>Cancel</button>
            <input
              type="checkbox" id="public-toggle" name="public-toggle"
              onChange={this.handlePublicChanged}
              checked={ni.IsPublic(note)}></input>
            <label htmlFor="public-toggle">public</label>
            <div className="right">
              <span>Format</span>
              {formatSelect}
            </div>
          </div>
        </div>
      </div>
    );
  }
});

module.exports = FullComposer;
