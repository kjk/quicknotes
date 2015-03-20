
function urlifyTitle(s) {
  s = s.slice(0,32)
  return s.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
}

var NotePartial = React.createClass({
  createLink: function(note, txt) {
    var s = {
      color: "gray"
    };
    var title = "";
    if (note.Title.length > 0) {
      title = "-" + urlifyTitle(note.Title);
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
