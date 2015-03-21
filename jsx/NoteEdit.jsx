var NoteEdit = React.createClass({
  getInitialState: function() {
    return {visible:false};
  },

  render: function() {
    if (this.state.visible) {
      return (
          <span className="btn-small"
               onClick={this.props.editCb}>
            edit
          </span>
      );
    } else {
      return <div />
    }
  }
});

module.exports = NoteEdit;
