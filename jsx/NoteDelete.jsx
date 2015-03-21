var NoteDelete = React.createClass({
  getInitialState: function() {
    return {visible:false};
  },

  handleDelete: function() {
    var note = this.props.note;
    console.log("deleteNote on: " + note.Title);
    this.props.deleteNoteCb(note);
  },

  render: function() {
    if (this.state.visible) {
      return (
          <span className="btn-small"
               onClick={this.handleDelete}>
            delete
          </span>
      );
    } else {
      return <div />
    }
  }
});

module.exports = NoteDelete;
