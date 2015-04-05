/* jshint -W097,-W117 */
'use strict';

// Note: unused
var NewNote = React.createClass({
  newNote: function() {
  },

  render: function() {
    return (
      <div className="left btn-small" onClick={this.newNote}>new note</div>
    );
  }
});

module.exports = NewNote;
