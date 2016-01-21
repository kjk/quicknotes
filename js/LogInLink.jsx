import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import * as action from './action.js';

function showImportSimpleNote(e) {
  e.preventDefault();
  action.showHideImportSimpleNote(true);
}

function showSettings(e) {
  e.preventDefault();
  console.log('showSettings');
  action.showSettings();
}

const LinkLoggedIn = (props) => {
  const url = encodeURI('/logout?redir=' + window.location);
  const userUrl = '/u/' + props.loggedInUserHandle;
  // <a href="#" onClick={this.handleSettings}>Settings</a>
  return (
    <div id="user">
      <a href={ userUrl } className="user">
        { props.loggedInUserHandle }
      </a>
      <div className="dropdown">
        <i className="fa fa-chevron-down"></i>
        <div className="dropdown-content">
          <a href={ userUrl }>My notes</a>
          { false ?
            <a href="#" onClick={ showSettings }>Settings</a>
            : null }
          { false ?
            <span className="divider"></span>
            : null }
          <a href="/import" onClick={ showImportSimpleNote }>Import from Simplenote</a>
          <span className="divider"></span>
          <a href={ url }>Sign Out</a>
        </div>
      </div>
    </div>
    );
};

LinkLoggedIn.propTypes = {
  loggedInUserHandle: PropTypes.string
};

const LinkLoggedOut = (props) => {
  const redir = encodeURIComponent(window.location.pathname);
  const twitterUrl = '/logintwitter?redir=' + redir;
  const googleUrl = '/logingoogle?redir=' + redir;
  const githubUrl = '/logingithub?redir=' + redir;
  return (
    <div id="user">
      <span className="user">Sign in / Sign up</span>
      <div className="dropdown">
        <i className="fa fa-chevron-down"></i>
        <div className="log-in-dropdown-content">
          <ul className="log-in">
            <li>
              <a className="twitter" href={ twitterUrl }>Sign in with Twitter</a>
            </li>
            <li>
              <a className="google" href={ googleUrl }>Sign in with Google</a>
            </li>
            <li>
              <a className="github" href={ githubUrl }>Sign in with GitHub</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
    );
};

export default class LogInLink extends Component {
  /*handleSettings(e) {
    e.preventDefault();
    console.log("handleSettings");
    action.showSettings();
  }*/

  render() {
    if (this.props.isLoggedIn) {
      return <LinkLoggedIn loggedInUserHandle={ this.props.loggedInUserHandle } />;
    } else {
      return <LinkLoggedOut />;
    }
  }
}

LogInLink.propTypes = {
  loggedInUserHandle: PropTypes.string,
  isLoggedIn: PropTypes.bool
};
