import React, { Component, PropTypes } from 'react';
import LogInLink from './LogInLink';
import keymaster from 'keymaster';
import * as action from './action';
import { focusSearch, isLoggedIn } from './utils';

// by default all keypresses are filtered
function keyFilter(event: any) {
  // always allow ESC
  if (event.keyCode == 27) {
    return true;
  }
  // always allow ctrl-enter
  if (event.ctrlKey && event.keyCode == 13) {
    return true;
  }
  // standard key filter, disable if inside those elements
  const tag = (event.target || event.srcElement).tagName;
  return !(tag == 'INPUT' || tag == 'SELECT' || tag == 'TEXTAREA');
}

interface State {
  searchTerm: any,
}

export default class Top extends Component<any, State> {

  searchNotesUser: any;

  constructor(props?: any, context?: any) {
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
    keymaster('/', () => {
      focusSearch(); return false;
    });
    keymaster('n', () => {
      action.editNewNote(); return false;
    });
  }

  componentWillUnmount() {
    action.offAllForOwner(this);

    keymaster.unbind('esc');
    keymaster.unbind('/');
    keymaster.unbind('n');
  }

  handleClearSearchTerm() {
    this.setState({
      searchTerm: ''
    });
  }

  handleInputKeyDown(e: any) {
    // on ESC loose focus and reset the value
    if (e.keyCode == 27) {
      e.preventDefault();
      e.target.blur();
      action.clearSearchTerm();
    }
  }

  handleInputChange(e: any) {
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

  handleEditNewNote(e: any) {
    // console.log('Top.handleEditNewNote');
    e.preventDefault();
    action.editNewNote();
  }

  render() {
    const withSearchInput = gNotesUser || gLoggedUser;

    let userUrl: any = null;
    if (gLoggedUser) {
      userUrl = '/u/' + gLoggedUser.HashID + '/' + gLoggedUser.Handle;
    }

    let placeholder = 'Search your notes (Esc or /)';
    if (gNotesUser) {
      if (!gLoggedUser || (gLoggedUser.HashID != gNotesUser.HashID)) {
        placeholder = `Search public notes by ${gNotesUser.Handle} (Esc or /)`;
        this.searchNotesUser = gNotesUser.HashID;
      }
    }
    if (!this.searchNotesUser && gLoggedUser) {
      this.searchNotesUser = gLoggedUser.HashID;
    }

    return (
      <div id='header' className='flex-row'>
        <a id='logo' className='logo colored' href='/'>QuickNotes</a>
        {userUrl ?
          <button className='btn btn-new-note hint--bottom' data-hint='shortcut: n' onClick={this.handleEditNewNote}>
            New note
          </button> : null}
        {withSearchInput ?
          <input name='search'
            id='search-input'
            value={this.state.searchTerm}
            onKeyDown={this.handleInputKeyDown}
            onChange={this.handleInputChange}
            type='text'
            autoComplete='off'
            autoCapitalize='off'
            placeholder={placeholder} /> : null}
        <div className='flex-push-right'></div>
        {userUrl ?
          <a href={userUrl} className='header-link'>My Notes</a> : null}
        <LogInLink />
      </div>
    );
  }
}
