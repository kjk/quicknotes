
var NotePartial = React.createClass({
  createPartialNote: function(note) {
    var s = {
      color: "gray"
    };
    var url = "/n/" + note.ID;
    return (
      <div className="note-more">
        <a href={url} target="_blank">more</a>
        &nbsp;<span style={s}>{note.HumanSize}</span>
      </div>
    );
  },

  render: function() {
    var note = this.props.note;
    if (note.IsPartial) {
      return this.createPartialNote(note);
    }
    return (
      <div></div>
    );
  }
});

module.exports = NotePartial;
