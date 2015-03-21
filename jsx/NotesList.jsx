var Note = require('./Note.jsx');
var NewNoteSmall = require('./NewNoteSmall.jsx');

var NotesList = React.createClass({

  render: function () {
    var compact = this.props.compact;
    var createNewTextNoteCb = this.props.createNewTextNoteCb;
    return (
      <div className="notes-list">
        <NewNoteSmall createNewTextNoteCb={createNewTextNoteCb}/>
        {this.props.notes.map(function(note) {
          return <Note compact={compact} note={note} key={note.IDStr}/>;
        })}
      </div>
    );
  }
});

module.exports = NotesList;
