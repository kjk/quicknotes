/* jshint -W097,-W117 */
'use strict';

var CodeMirrorEditor = require('./CodeMirrorEditor.jsx');

function tagsToText(tags) {
  if (!tags) {
    return "";
  }
  var s = "";
  tags.forEach(function(tag) {
    if (s != "") {
      s += " ";
    }
    s += "#" + tag;
  });
  return s;
}

var FullComposer = React.createClass({
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
  },

  componentDidUpdate: function() {
    var el = React.findDOMNode(this.refs.editArea);
    el.focus();
  },

  textChanged: function(e) {
    var s = e.target.value;
    console.log("s: " + s);
    var el = React.findDOMNode(this.refs.preview);
    el.value = s;
    e.preventDefault();
  },

  render: function() {
    var note = this.props.note;
    var content = note.Content;
    var title = note.Title;
    var tags = tagsToText(note.Tags);
    var isPublic = note.IsPublic;

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
            onChange={this.textChanged}
            ref="editArea" />
          <div id="full-composer-preview" ref="preview"></div>
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
