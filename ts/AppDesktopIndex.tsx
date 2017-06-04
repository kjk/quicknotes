import React, { Component } from 'react';
import * as ReactDOM from 'react-dom';

import Top from './Top';

class LogIn extends Component<any, any> {
  constructor(props?: any, context?: any) {
    super(props, context);
  }

  render() {
    const style: React.CSSProperties = {
      maxWidth: 320,
    };
    const redir = encodeURIComponent(window.location.pathname);
    const twitterUrl = '/logintwitter?redir=' + redir;
    const googleUrl = '/logingoogle?redir=' + redir;
    const githubUrl = '/logingithub?redir=' + redir;
    return (
      <div style={style}>
        <ul className="log-in">
          <li>
            <a className="twitter" href={twitterUrl}>Sign in with Twitter</a>
          </li>
          <li>
            <a className="google" href={googleUrl}>Sign in with Google</a>
          </li>
          <li>
            <a className="github" href={githubUrl}>Sign in with GitHub</a>
          </li>
        </ul>
      </div>
    );
  }
}

export default class AppDesktopIndex extends Component<any, any> {
  constructor(props: any, context: any) {
    super(props, context);
  }

  render() {
    const style: React.CSSProperties = {
      justifyContent: 'center',
    };

    return (
      <div>
        <Top hideLogin={true} />
        <div id="tagline">
          <h1>Plase Sign In</h1>
        </div>
        <div className="flex-row" style={style}>
          <LogIn />
        </div>
      </div>
    );
  }
}
