var Note = require('./Note.jsx');
var NewNoteSmall = require('./NewNoteSmall.jsx');

var NotesList = React.createClass({

  render: function () {
    var compact = this.props.compact;
    return (
      <div className="notes-list">
        <NewNoteSmall />
        {this.props.notes.map(function(note) {
          return <Note compact={compact} note={note} key={note.IDStr}/>;
        })}
      </div>
    );
  }
});

module.exports = NotesList;
