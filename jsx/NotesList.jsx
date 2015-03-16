var Note = require('./Note.jsx');
var NewNoteSmall = require('./NewNoteSmall.jsx');

var NotesList = React.createClass({

  createNote: function(note) {
    return (
        <Note compact={this.props.compact} note={note} key={note.ID}/>
      );
  },

  render: function () {
    return (
      <div className="notes-list">
        <NewNoteSmall />
        {this.props.notes.map(this.createNote)}
      </div>
    );
  }
});

module.exports = NotesList;
