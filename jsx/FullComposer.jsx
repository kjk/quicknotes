/* jshint -W097,-W117 */
'use strict';

var CodeMirrorEditor = require('./CodeMirrorEditor.jsx');
var utils = require('./utils.js');
var format = require('./format.js');
var _ = require('./underscore.js');

function arrEmpty(a) {
  return !a || (a.length === 0);
}

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
    if (n1.IsPublic != n2.IsPublic) {
      return true;
    }
    if (n1.Title != n2.Title) {
      return true;
    }
    // Note: maybe should compare after trim() ?
    var c1 = n1.Content;
    var c2 = n2.Content;
    if (c1 != c2) {
      return true;
    }
    if (n1.Format != n2.Format) {
      return true;
    }
    if (!arrEmpty(n1.Tags) || !arrEmpty(n2.Tags)) {
      if (arrEmpty(n1.Tags) || arrEmpty(n2.Tags)) {
        return true;
      }
      var tags1 = n1.Tags.sort();
      var tags2 = n2.Tags.sort();
      var len = tags1.length;
      if (len != tags2.length) {
        return true;
      }
      for (var i=0; i < len; i++) {
        if (tags1[i] != tags2[i]) {
          return true;
        }
      }
    }
    return false;
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
    this.updatePreview(this.props.note.Content);
  },

  updatePreview: function(s) {
    var note = this.state.note;
    if (note.Format == format.Text) {
      s = "<pre>" + _.escape(s) + "</pre>";
    } else if (note.Format == format.Markdown) {
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
    note.Content = s;
    this.setState({
      note: note
    });
    this.updatePreview(s);
  },

  handlePublicChanged: function(e) {
    var note = utils.deepCloneObject(this.state.note);
    note.IsPublic = e.target.checked;
    this.setState({
      note: note
    });
  },

  handleTitleChanged: function(e) {
    var s = e.target.value.trim();
    var note = utils.deepCloneObject(this.state.note);
    note.Title = s;
    this.setState({
      note: note
    });
  },

  handleTagsChanged: function(e) {
    var tagsStr = e.target.value;
    var note = utils.deepCloneObject(this.state.note);
    note.Tags = textToTags(tagsStr);
    this.setState({
      note: note
    });
  },

  handleFormatChanged: function(e) {
    var formatName = e.target.value;
    var note = utils.deepCloneObject(this.state.note);
    note.Format = format.nameToNumber(formatName);
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
    var initialTags = tagsToText(this.props.note.Tags);
    var note = this.state.note;
    var previewHtml = { __html: this.state.previewHtml };
    var saveDisabled = !this.noteChanged();
    var formatTxt = format.numberToName(note.Format);
    var formatSelect = this.renderFormatSelect(format.Formats, formatTxt);

    // TODO: if editing code, change CodeMirror mode property to match code being edited
    return (
      <div id="full-composer-wrapper">
        <div id="full-composer-title">
          <span>Title:</span>
          <input
            style={{flexGrow: 3}}
            type="text"
            onChange={this.handleTitleChanged}
            value={note.Title} size="128"/>
        </div>

        <div id="full-composer-tags">
          <span>Tags:</span>
          <input
            style={{flexGrow: 3}}
            type="text"
            onChange={this.handleTagsChanged}
            defaultValue={initialTags}
            size="128"/>
        </div>

        <div id="full-composer-top">
          <CodeMirrorEditor
            mode="text"
            className="full-composer-editor"
            codeText={note.Content}
            value={note.Content}
            onChange={this.textChanged}
            ref="editArea" />
          <div id="full-composer-preview" dangerouslySetInnerHTML={previewHtml}></div>
        </div>
        <div id="full-composer-bottom">
          <button onClick={this.handleSave} disabled={saveDisabled}>Save</button>
          <button onClick={this.handleCancel}>Cancel</button>
          <input
            type="checkbox"
            onChange={this.handlePublicChanged}
            checked={note.IsPublic}>public</input>
          &nbsp;&nbsp;format:&nbsp;
          {formatSelect}
        </div>
      </div>
    );
  }
});

module.exports = FullComposer;
