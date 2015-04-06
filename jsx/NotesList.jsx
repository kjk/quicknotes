/* jshint -W097,-W117 */
'use strict';

var Note = require('./Note.jsx');

// TODO: implement infinite scroll by adding more notes on scroll
// Note: rendering too many notes in a single render cycle causes noticeable
// pause at startup and when filtering notes via tags. Empirically, 50 is
// instantaneous. Around 100 there's a bit of a lag. At 800 it becomes bad.
var maxInitialNotes = 50;
function truncateNotes(notes) {
  if (maxInitialNotes != -1 && notes.length >= maxInitialNotes) {
    return notes.slice(0, maxInitialNotes);
  }
  return notes;
}

var NotesList = React.createClass({
  getInitialState: function() {
    return {
      notes: truncateNotes(this.props.notes)
    };
  },

  componentWillReceiveProps: function(nextProps) {
    this.setState({
      notes: truncateNotes(nextProps.notes)
    });
  },

  render: function () {
    var self = this;
    return (
      <div id="notes-list">
        {this.state.notes.map(function(note) {
          return <Note
            compact={self.props.compact}
            note={note}
            key={note.IDStr}
            myNotes={self.props.myNotes}
            delUndelNoteCb={self.props.delUndelNoteCb}
            makeNotePublicPrivateCb={self.props.makeNotePublicPrivateCb}
            startUnstarNoteCb={self.props.startUnstarNoteCb}
            editCb={self.props.editCb}
          />;
        })}
      </div>
    );
  }
});

module.exports = NotesList;
