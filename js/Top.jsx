import React, { Component, PropTypes } from 'react';
import LogInLink from './LogInLink.jsx';
import keymaster from 'keymaster';
import * as action from './action.js';
import { focusSearch, isLoggedIn } from './utils.js';

// by default all keypresses are filtered
function keyFilter(event) {
  // always allow ESC and ctrl-enter
  if (event.keyCode == 27) {
    return true;
  }
  if (event.keyCode == 13 && event.ctrlKey) {
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

    this.searchNotesUser = null;

    this.state = {
      searchTerm: ''
    };
  }

  componentDidMount() {
    action.onClearSearchTerm(this.handleClearSearchTerm, this);

    keymaster.filter = keyFilter;
    keymaster('ctrl+f', focusSearch);
    keymaster('ctrl+n', () => action.editNewNote());
    //keymaster('ctrl+e', focusNewNote);
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

  handleEditNewNote(e) {
    // console.log('Top.handleEditNewNote');
    e.preventDefault();
    action.editNewNote();
  }

  render() {
    const withSearchInput = gNotesUser || gLoggedUser;

    let userUrl = null;
    if (gLoggedUser) {
      userUrl = '/u/' + gLoggedUser.HashID + '/' + gLoggedUser.Handle;
    }

    let placeholder = 'Search your notes (Ctrl-F)';
    if (gNotesUser) {
      if (!gLoggedUser || (gLoggedUser.HashID != gNotesUser.HashID)) {
        placeholder = `Search public notes by ${gNotesUser.Handle} (Ctrl-F)`;
        this.searchNotesUser = gNotesUser.HashID;
      }
    }
    if (!this.searchNotesUser && gLoggedUser) {
      this.searchNotesUser = gLoggedUser.HashID;
    }

    return (
      <div id="header" className="flex-row">
        <a id="logo" className="logo colored" href="/">QuickNotes</a>
        { userUrl ?
          <button className="btn btn-new-note hint--bottom" data-hint="Ctrl-N" onClick={ this.handleEditNewNote }>
            New note
          </button> : null }
        { withSearchInput ?
          <input name="search"
            id="search-input"
            value={ this.state.searchTerm }
            onKeyDown={ this.handleInputKeyDown }
            onChange={ this.handleInputChange }
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            placeholder={ placeholder } /> : null }
        { userUrl ?
          <a href={ userUrl } className="header-link">My Notes</a> : null }
        <LogInLink />
      </div>
      );
  }
}
