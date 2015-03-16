var NoteEdit = React.createClass({
  getInitialState: function() {
    return {visible:false};
  },

  render: function() {
    if (this.state.visible) {
      return (
          <div className="btn-small note-edit"
               onClick={this.props.editCb}>
            edit
          </div>
      );
    } else {
      return <div />
    }
  }
});

module.exports = NoteEdit;
