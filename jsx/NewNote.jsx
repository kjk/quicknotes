/* jshint -W097 */
'use strict';

// Note: unused
var NewNote = React.createClass({
  newNote: function() {
  },

  render: function() {
    var s = {
      marginLeft: 8
    };

    return (
      <div className="left btn-small"
        style={s}
        onClick={this.newNote}
      >new note</div>
    );
  }
});

module.exports = NewNote;
