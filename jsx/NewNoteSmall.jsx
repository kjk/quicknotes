/* jshint -W097 */
'use strict';

var NewNoteSmall = React.createClass({
  newNote: function(s) {
    this.props.createNewTextNoteCb(s);
  },

  handleKeyPress: function(e) {
    // ctrl+Enter submits a note
    if (e.charCode == 13 && e.ctrlKey) {
        e.preventDefault();
        var s = e.target.value;
        e.target.value = "";
        this.newNote(s);
        return;
    }
    //console.log("handleKeyPress: code:", e.charCode, " ctrl: ", e.ctrlKey);
  },

  render: function() {
    return (
      <div id="composer">
        <textarea
            id="newNoteSmall"
            placeholder="enter new note"
            onKeyPress={this.handleKeyPress}
          />
      </div>
      );
  }
});

module.exports = NewNoteSmall;
