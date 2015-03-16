
// Note: unused
var NewNote = React.createClass({
  newNote: function() {
    console.log("new note");
  },

  render: function() {
    var s = {
      marginLeft: 8
    };

    return (
      <div className="left btn-small"
        style={s}
        onClick={this.newNote}
      >new note</div>
    );
  }
});

module.exports = NewNote;
