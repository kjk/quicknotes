/* jshint -W097,-W117 */
'use strict';

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

  render: function() {
    var note = this.props.note;
    if (!this.props.note) {
      return (
        <div id="full-composer-wrapper" className="collapsed">
        </div>
      );
    }
    var noteContent = note.Snippet;
    return (
      <div id="full-composer-wrapper">
        <div id="full-composer-top">
          <textarea id="full-composer-textarea">{noteContent}</textarea>
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
