/* jshint -W097,-W117 */
'use strict';

var CodeMirrorEditor = require('./CodeMirrorEditor.jsx');
var utils = require('./utils.js');
var format = require('./format.js');

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
    // TODO: trim title/content, compare tags, format etc.
    if (n1.IsPublic != n2.IsPublic) {
      return true;
    }
    if (n1.Title != n2.Title) {
      return true;
    }
    if (n1.Content != n2.Content) {
      return true;
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
    this.updatePreview(s);
  },

  render: function() {
    var note = this.state.note;
    var content = note.Content;
    var title = note.Title;
    var tags = tagsToText(note.Tags);
    var isPublic = note.IsPublic;
    var previewHtml = { __html: this.state.previewHtml };

    return (
      <div id="full-composer-wrapper">
        <div id="full-composer-title">
          <span>Title:</span>
          <input type="text" defaultValue={title} size="80"/>
        </div>

        <div id="full-composer-tags">
          <span>Tags:</span>
          <input type="text" defaultValue={tags} size="80"/>
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
          <button onClick={this.handleSave}>Save</button>
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
