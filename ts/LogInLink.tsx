import React, { Component } from 'react';
import * as ReactDOM from 'react-dom';
import * as action from './action';
import { isLoggedIn } from './utils';
import page from 'page';

function showImportSimpleNote(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  action.showHideImportSimpleNote(true);
}

function showSettings(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  console.log('showSettings');
  action.showSettings();
}

export class LogOut extends Component<any, any> {
  constructor(props?: any, context?: any) {
    super(props, context);
  }

  render() {
    const url = encodeURI('/logout?redir=' + window.location);
    const u = gLoggedUser;
    const userUrl = '/u/' + u.HashID + '/' + u.Handle;
    // TODO: enable when running locally
    const isDebug = gIsDebug;

    return (
      <div id="login-link">
        <a href={userUrl} className="header-link">
          {u.Handle} <i className="fa fa-chevron-down login-chevron" />
        </a>
        <div className="dropdown-content">
          <a href={userUrl}>My notes</a>
          {isDebug
            ? <a href="/dbg/shownotes" target="_blank">
                {' '}Show Notes
              </a>
            : null}
          {false
            ? <a href="#" onClick={showSettings}>
                Settings
              </a>
            : null}
          {false ? <span className="divider" /> : null}
          <a href="/import" onClick={showImportSimpleNote}>
            Import from Simplenote
          </a>
          <span className="divider" />
          <a href={url}>Sign Out</a>
        </div>
      </div>
    );
  }
}

export class LogIn extends Component<any, any> {
  constructor(props?: any, context?: any) {
    super(props, context);
  }

  render() {
    const redir = encodeURIComponent(window.location.pathname);
    const twitterUrl = '/logintwitter?redir=' + redir;
    const googleUrl = '/logingoogle?redir=' + redir;
    const githubUrl = '/logingithub?redir=' + redir;
    return (
      <div id="login-link">
        <span className="header-link">
          Sign in / Sign up <i className="fa fa-chevron-down login-chevron" />
        </span>
        <div className="log-in-dropdown-content">
          <ul className="log-in">
            <li>
              <a className="twitter" href={twitterUrl}>
                Sign in with Twitter
              </a>
            </li>
            <li>
              <a className="google" href={googleUrl}>
                Sign in with Google
              </a>
            </li>
            <li>
              <a className="github" href={githubUrl}>
                Sign in with GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
    );
  }
}

export class LogInLink extends Component<any, any> {
  constructor(props?: any, context?: any) {
    super(props, context);
  }

  render() {
    if (isLoggedIn()) {
      return <LogOut />;
    } else {
      return <LogIn />;
    }
  }
}
