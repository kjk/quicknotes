
var NotePartial = React.createClass({
  render: function() {
    var spanStyle = {
      color: "gray"
    };
    var note = this.props.note;
    if (note.IsPartial) {
      return (
        <div className="note-more">
          <a href="/n/{note.ID}" target="_blank">more</a>
          &nbsp;<span style={spanStyle}>{note.HumanSize}</span>
        </div>
      );
    } else {
      return <div></div>
    }
  }
});

module.exports = NotePartial;
