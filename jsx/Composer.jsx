/* jshint -W097,-W117 */
'use strict';

var Composer = React.createClass({
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

  handleOnFocus: function(e) {
    this.props.startNewNoteCb();
    e.preventDefault();
  },

  render: function() {
    return (
      <div id="composer">
        <div className="inner">
          <textarea
            id="Composer"
            onFocus={this.handleOnFocus}
            placeholder="Enter new note (Ctrl-E)"
            onKeyPress={this.handleKeyPress}
          />
        </div>
      </div>
      );
  }
});

module.exports = Composer;
