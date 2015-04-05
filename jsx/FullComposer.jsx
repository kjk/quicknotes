/* jshint -W097,-W117 */
'use strict';

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
    e.preventDefault();
  },

  render: function() {
    var note = this.props.note;
    var content = note.Content;
    var title = note.Title;
    var tags = tagsToText(note.Tags);
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
          <textarea
            id="full-composer-textarea"
            value={content}
            onChange={this.textChanged}
            ref="editArea"></textarea>
          <div id="full-composer-preview"></div>
        </div>
        <div id="full-composer-bottom">
          <button onClick={this.handleSave}>Save</button>
          <button onClick={this.handleCancel}>Cancel</button>
        </div>
      </div>
      );
  }
});

module.exports = FullComposer;
