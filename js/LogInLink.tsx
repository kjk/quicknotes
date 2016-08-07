import React, { Component, PropTypes } from 'react';
import * as ReactDOM from 'react-dom';
import * as action from './action';
import { isLoggedIn } from './utils';

function showImportSimpleNote(e: React.MouseEvent) {
  e.preventDefault();
  action.showHideImportSimpleNote(true);
}

function showSettings(e: React.MouseEvent) {
  e.preventDefault();
  console.log('showSettings');
  action.showSettings();
}

export default class LogInLink extends Component<{}, {}> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.renderLoggedIn = this.renderLoggedIn.bind(this);
    this.renderLoggedOut = this.renderLoggedOut.bind(this);
  }

  renderLoggedIn() {
    const url = encodeURI('/logout?redir=' + window.location);
    const u = gLoggedUser;
    const userUrl = '/u/' + u.HashID + '/' + u.Handle;
    return (
      <div id='login-link'>
        <a href={ userUrl } className='header-link'>
          { u.Handle } <i className='fa fa-chevron-down login-chevron'></i></a>
        <div className='dropdown-content'>
          <a href={ userUrl }>My notes</a>
          { false ?
            <a href='#' onClick={ showSettings }>Settings</a>
            : null }
          { false ?
            <span className='divider'></span>
            : null }
          <a href='/import' onClick={ showImportSimpleNote }>Import from Simplenote</a>
          <span className='divider'></span>
          <a href={ url }>Sign Out</a>
        </div>
      </div>
    );
  }

  renderLoggedOut() {
    const redir = encodeURIComponent(window.location.pathname);
    const twitterUrl = '/logintwitter?redir=' + redir;
    const googleUrl = '/logingoogle?redir=' + redir;
    const githubUrl = '/logingithub?redir=' + redir;
    return (
      <div id='login-link'>
        <span className='header-link'>Sign in / Sign up <i className='fa fa-chevron-down login-chevron'></i></span>
        <div className='log-in-dropdown-content'>
          <ul className='log-in'>
            <li>
              <a className='twitter' href={ twitterUrl }>Sign in with Twitter</a>
            </li>
            <li>
              <a className='google' href={ googleUrl }>Sign in with Google</a>
            </li>
            <li>
              <a className='github' href={ githubUrl }>Sign in with GitHub</a>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  render() {
    if (isLoggedIn()) {
      return this.renderLoggedIn();
    } else {
      return this.renderLoggedOut();
    }
  }
}
