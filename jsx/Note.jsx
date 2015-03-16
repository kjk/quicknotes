var NoteEdit = require('./NoteEdit.jsx');
var NotePartial = require('./NotePartial.jsx');

var Note = React.createClass({
  createTitle: function(note) {
    if (note.Title != "") {
      var cls = "title tcol" + note.ColorID;
      return (
        <span className={cls}>{note.Title}</span>
        );
    };
  },

  createTags: function(tags) {
    if (tags) {
      var tagEls = tags.map(function (tag) {
        tag = "#" + tag
        return (
          <span className="titletag">{tag}</span>
        )
      });
      return (
        <span>{tagEls}</span>
      );
    }
  },

  editNote: function() {
    var note = this.props.note;
    console.log("editNote on: " + note.Title);
  },

  mouseEnter: function(e) {
    e.preventDefault();
    this.refs.editBtn.setState({visible:true});
  },

  mouseLeave: function(e) {
    e.preventDefault();
    this.refs.editBtn.setState({visible:false});
  },

  createNoteBody: function(note) {
      return (
        <NotePartial note={note} />
      );
    },

  createNoteSnippet: function(note) {
    if (!this.props.compact) {
      return (
        <span className="message">
          <pre className="snippet">{note.Snippet}</pre>
        </span>
      );
    }
  },

  render: function() {
    var note = this.props.note;
    return (
      <div className="one-note"
        onMouseEnter={this.mouseEnter}
        onMouseLeave={this.mouseLeave}
        >
        <div>
          {this.createTitle(note)}
          {this.createTags(note.Tags)}
        </div>
        {this.createNoteSnippet(note)}
        <NoteEdit note={note} editCb={this.editNote} ref="editBtn"/>
        {this.createNoteBody(note)}
      </div>
    );
  }
});

module.exports = Note
