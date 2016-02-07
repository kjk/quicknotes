import React, { Component, PropTypes } from 'react';
import LogInLink from './LogInLink.jsx';
import keymaster from 'keymaster';
import * as action from './action.js';
import * as u from './utils.js';

// by default all keypresses are filtered
function keyFilter(event) {
  if (event.keyCode == 27) {
    // allow ESC always
    return true;
  }
  // standard key filter, disable if inside those elements
  const tag = (event.target || event.srcElement).tagName;
  return !(tag == 'INPUT' || tag == 'SELECT' || tag == 'TEXTAREA');
}

export default class Top extends Component {
  constructor(props, context) {
    super(props, context);

    this.handleClearSearchTerm = this.handleClearSearchTerm.bind(this);
    this.handleEditNewNote = this.handleEditNewNote.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleInputKeyDown = this.handleInputKeyDown.bind(this);
    this.renderSearchInput = this.renderSearchInput.bind(this);

    this.searchNotesUser = null;

    this.state = {
      searchTerm: ''
    };
  }

  componentDidMount() {
    action.onClearSearchTerm(this.handleClearSearchTerm, this);

    keymaster.filter = keyFilter;
    keymaster('ctrl+f', u.focusSearch);
    keymaster('ctrl+n', () => action.editNewNote());
    //keymaster('ctrl+e', u.focusNewNote);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);

    keymaster.unbind('ctrl+f');
    keymaster.unbind('ctrl+n');
    //keymaster.unbind('ctrl+e');
  }

  handleClearSearchTerm() {
    this.setState({
      searchTerm: ''
    });
  }

  handleInputKeyDown(e) {
    // on ESC loose focus and reset the value
    if (e.keyCode == 27) {
      e.preventDefault();
      e.target.blur();
      action.clearSearchTerm();
    }
  }

  handleInputChange(e) {
    const user = this.searchNotesUser;
    const searchTerm = e.target.value;
    this.setState({
      searchTerm: searchTerm
    });
    if (searchTerm === '') {
      action.clearSearchTerm();
    } else {
      action.startSearchDelayed(user, searchTerm);
    }
  }

  renderSearchInput() {
    if (!gNotesUser && !gLoggedUser) {
      return;
    }
    let placeholder = 'Search your notes (Ctrl-F)';
    if (gNotesUser) {
      if (!gLoggedUser || (gLoggedUser.HashID != gNotesUser.HashID)) {
        placeholder = `Search public notes by ${gNotesUser.Handle} (Ctrl-F)`;
        this.searchNotesUser = gNotesUser.HashID;
      }
    }
    if (!this.searchNotesUser) {
      this.searchNotesUser = gLoggedUser.HashID;
    }

    return (
      <input name="search"
        id="search-input"
        value={this.state.searchTerm}
        onKeyDown={ this.handleInputKeyDown }
        onChange={ this.handleInputChange }
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        placeholder={ placeholder } />
      );
  }

  handleEditNewNote(e) {
    e.preventDefault();
    console.log('Top.handleEditNewNote');
    action.editNewNote();
  }

  renderNewNote() {
    if (u.isLoggedIn()) {
      return (
        <a id="new-note"
          title="Create new note (ctrl-n)"
          href="#"
          onClick={ this.handleEditNewNote }><i className="icn-plus"></i></a>
        );
    }
  }

  render() {
    return (
      <div id="header">
        <a id="logo" className="logo colored" href="/">QuickNotes</a>
        { this.renderNewNote() }
        { this.renderSearchInput() }
        <LogInLink />
      </div>
      );
  }
}
