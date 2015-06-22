/* jshint -W097,-W117 */
'use strict';

var LogInLink = require('./LogInLink.jsx');

var Top = React.createClass({

  handleInputKeyDown: function(e) {
    // on ESC loose focus and reset the value
    if (e.keyCode == 27) {
      e.preventDefault();
      e.target.blur();
      e.target.value = "";
      this.props.searchTermChangedCb("");
    }
  },

  handleInputChange: function(e) {
    this.props.searchTermChangedCb(e.target.value);
  },

  createSearchInput: function() {
    var userHandle = this.props.notesUserHandle;
    if (userHandle === "") {
      return;
    }
    var placeholder = "Search notes by " + userHandle + " (Ctrl-F)";
    if (userHandle == gLoggedInUserHandle) {
      placeholder = "Search your notes (Ctrl-F)";
    }
    return (
      <div id="search-wrapper" className="left">
        <input name="search" id="search"
          onKeyDown={this.handleInputKeyDown}
          onChange={this.handleInputChange}
          className="round-input input-not-focused"  type="text"
          autoComplete="off" autoCapitalize="off"
          placeholder={placeholder} />
      </div>
    );
  },

  handleCreateNewNote: function(e) {
    e.preventDefault();
    this.props.startNewNoteCb();
  },

  createNewNote: function() {
    if (this.props.isLoggedIn) {
      return (
        <a id="new-note" title="Create new note" href="#" onClick={this.handleCreateNewNote}>
          <i className="icn-plus"></i>
        </a>
      );
    }
  },

  render: function() {
    return (
      <div id="header">
        <a id="logo" className="logo colored" href="/">QuickNotes</a>
        {this.createNewNote()}
        {this.createSearchInput()}
        <LogInLink isLoggedIn={this.props.isLoggedIn}
          loggedInUserHandle={this.props.loggedInUserHandle}/>
      </div>
    );
  }
});

module.exports = Top;
