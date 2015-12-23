/* jshint -W097,-W117 */
'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

var action = require('./action.js');

var LogInLink = React.createClass({

  handleSettings: function(e) {
    e.preventDefault();
    console.log("handleSettings");
    action.showSettings();
  },


  renderLoggedIn: function() {
    var url = encodeURI("/logout?redir=" + window.location);
    var userUrl = "/u/" + this.props.loggedInUserHandle;

    // <a href="#" onClick={this.handleSettings}>Settings</a>
    return (
      <div id="user">
        <a href={userUrl} className="user">
          {this.props.loggedInUserHandle}
        </a>
        <div className="dropdown">
          <i className="fa fa-chevron-down"></i>
          <div className="dropdown-content">
            <a href={userUrl}>My notes</a>
            <span className="divider"></span>
            <a href="/import">Import notes</a>
            <span className="divider"></span>
            <a href={url}>Sign Out</a>
          </div>
        </div>
      </div>
    );
  },

  renderLoggedOut: function() {
    var twitterUrl = encodeURI("/logintwitter?redir=" + window.location);
    return (
      <div id="user">
        <span className="user">
          Sign in / Sign up
        </span>
        <div className="dropdown">
          <i className="fa fa-chevron-down"></i>
          <div className="log-in-dropdown-content">
            <ul className="log-in">
              <li><a className="twitter" href={twitterUrl}>Sign in with Twitter</a></li>
              <li><a className="google" href="/logingoogle?redir=%2F">Sign in with Google</a></li>
              <li><a className="github" href="/logingithub?redir=%2F">Sign in with GitHub</a></li>
            </ul>
          </div>
        </div>
      </div>
    );
  },

  render: function() {
    if (this.props.isLoggedIn) {
      return this.renderLoggedIn();
    } else {
      return this.renderLoggedOut();
    }
  }
});

module.exports = LogInLink;
