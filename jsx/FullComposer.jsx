/* jshint -W097,-W117 */
'use strict';

var CodeMirrorEditor = require('./CodeMirrorEditor.jsx');
var utils = require('./utils.js');
var format = require('./format.js');

function arrEmpty(a) {
  if (!a || a.length === 0) {
    return true;
  }
  return false;
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
    if (n1.Content != n2.Content) {
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
      for (var i=0; i < n; i++) {
        if (tags1[i] != tags2[i]) {
          return true;
        }
      }
    }
    return false;
  },

  handleSave: function(e) {
      console.log("onSave");
      e.preventDefault();
      // TODO: get properties on the note before calling save
      this.props.saveNoteCb(this.props.note);
  },

  handleCancel: function(e) {
    console.log("onCancel");
    e.preventDefault();
    this.props.cancelNoteEditCb(this.props.note);
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.editArea);
    el.focus();
    this.updatePreview(this.props.note.Content);
  },

  /*componentDidUpdate: function() {
    var el = React.findDOMNode(this.refs.editArea);
    el.focus();
  },*/

  updatePreview: function(s) {
    var note = this.state.note;
    if (note.Format == format.Text) {
      // TODO: escape html chars in s
      s = "<pre>" + s + "</pre>";
    } else if (note.Format == format.Markdown) {
      // TODO: call api to convert to html
      s = "<pre>" + s + "</pre>";
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
      e.preventDefault();
    }
    s = s.trim();
    this.updatePreview(s);
  },

  handleTitleChanged: function(e) {
    e.preventDefault();
    var s = e.target.value.trim();
    var note = utils.deepCloneObject(this.state.note);
    note.Title = s;
    this.setState({
      note: note
    });
  },

  handleTagsChanged: function(e) {
    e.preventDefault();
    var s = e.target.value;
    console.log("new tags: " + s);
    var note = utils.deepCloneObject(this.state.note);
    note.Tags = textToTags(s);
    console.log("new tags arr: " + note.Tags);
    this.setState({
      note: note
    });
  },

  render: function() {
    var initialTags = tagsToText(this.props.note.Tags);

    var note = this.state.note;
    var content = note.Content;
    var title = note.Title;
    var isPublic = note.IsPublic;
    var previewHtml = { __html: this.state.previewHtml };
    var saveDisabled = !this.noteChanged();

    return (
      <div id="full-composer-wrapper">
        <div id="full-composer-title">
          <span>Title:</span>
          <input type="text" onChange={this.handleTitleChanged} value={title} size="80"/>
        </div>

        <div id="full-composer-tags">
          <span>Tags:</span>
          <input type="text" onChange={this.handleTagsChanged} defaultValue={initialTags} size="80"/>
        </div>

        <div id="full-composer-top">
          <CodeMirrorEditor
            className="full-composer-editor"
            codeText={content}
            value={content}
            onChange={this.textChanged}
            ref="editArea" />
          <div id="full-composer-preview" dangerouslySetInnerHTML={previewHtml}></div>
        </div>
        <div id="full-composer-bottom">
          <button onClick={this.handleSave} disabled={saveDisabled}>Save</button>
          <button onClick={this.handleCancel}>Cancel</button>
          <input
            type="checkbox"
            defaultChecked={isPublic}
            ref="isPublic">public</input>
        </div>
      </div>
    );
  }
});

module.exports = FullComposer;
