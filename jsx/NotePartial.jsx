
// TODO: should also replace non-kosher characters with url-safe things
function urlify(s) {
  if (s.length <= 32) {
    return s;
  }
  return s.slice(0,32)
}

var NotePartial = React.createClass({
  createLink: function(note, txt) {
    var s = {
      color: "gray"
    };
    // TODO: shorten title
    var title = "";
    if (note.Title.length > 0) {
      title = "-" + urlify(note.Title);
    }
    var url = "/n/" + note.IDStr + title;
    return (
      <div className="note-more">
        <a href={url} target="_blank">{txt}</a>
        &nbsp;<span style={s}>{note.HumanSize}</span>
      </div>
    );
  },

  render: function() {
    var note = this.props.note;
    if (note.IsPartial) {
      return this.createLink(note, "more");
    } else {
      return this.createLink(note, "view");
    }
  }
});

module.exports = NotePartial;
