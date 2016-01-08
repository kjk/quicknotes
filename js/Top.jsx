import React from 'react';
import LogInLink from './LogInLink.jsx';

export default class Top extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.handleCreateNewNote = this.handleCreateNewNote.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleInputKeyDown = this.handleInputKeyDown.bind(this);
  }

  handleInputKeyDown(e) {
    // on ESC loose focus and reset the value
    if (e.keyCode == 27) {
      e.preventDefault();
      e.target.blur();
      e.target.value = '';
      this.props.onSearchTermChanged('');
    }
  }

  handleInputChange(e) {
    this.props.onSearchTermChanged(e.target.value);
  }

  renderSearchInput() {
    const userHandle = this.props.notesUserHandle;
    if (userHandle === '') {
      return;
    }
    let placeholder = 'Search notes by ' + userHandle + ' (Ctrl-F)';
    if (userHandle == gLoggedInUserHandle) {
      placeholder = 'Search your notes (Ctrl-F)';
    }
    return (
      <div id="search-wrapper" className="left">
        <input name="search"
          id="search"
          onKeyDown={ this.handleInputKeyDown }
          onChange={ this.handleInputChange }
          className="round-input input-not-focused"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          placeholder={ placeholder } />
      </div>
      );
  }

  handleCreateNewNote(e) {
    e.preventDefault();
    this.props.onStartNewNote();
  }

  renderNewNote() {
    if (this.props.isLoggedIn) {
      return (
        <a id="new-note"
          title="Create new note"
          href="#"
          onClick={ this.handleCreateNewNote }><i className="icn-plus"></i></a>
        );
    }
  }

  render() {
    return (
      <div id="header">
        <a id="logo" className="logo colored" href="/">QuickNotes</a>
        { this.renderNewNote() }
        { this.renderSearchInput() }
        <LogInLink isLoggedIn={ this.props.isLoggedIn } loggedInUserHandle={ this.props.loggedInUserHandle } />
      </div>
      );
  }
}

Top.propTypes = {
  onSearchTermChanged: React.PropTypes.function.isRequired,
  onStartNewNote: React.PropTypes.function.isRequired,
  isLoggedIn: React.PropTypes.bool.isRequired,
  loggedInUserHandle: React.PropTypes.string,
  notesUserHandle: React.PropTypes.string
};
