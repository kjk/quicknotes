/* jshint -W097,-W117 */
'use strict';

// http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html

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
    var node = React.findDOMNode(this);
    node.scrollTop = 0;
    this.setState({
      notes: truncateNotes(nextProps.notes)
    });
  },

  handleScroll: function(e) {
    e.preventDefault();
    var nShowing = this.state.notes.length;
    var total = this.props.notes.length;
    if (nShowing >= total) {
      return;
    }
    var node = e.target;
    var top = node.scrollTop;
    var dy = node.scrollHeight;
    // a heuristic, maybe push it down
    var addMore = top > dy/2;
    if (!addMore) {
      return;
    }
    //console.log("top: " + top + " height: " + dy);
    var last = nShowing + 10;
    if (last > total) {
      last = total;
    }
    var notes = this.state.notes;
    for (var i = nShowing; i < last; i++) {
      notes.push(this.props.notes[i]);
    }
    //console.log("new number of notes: " + notes.length);
    this.setState({
      notes: notes,
    });
  },

  render: function () {
    var self = this;
    return (
      <div id="notes-list" onScroll={this.handleScroll}>
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
