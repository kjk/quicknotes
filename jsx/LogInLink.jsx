/* jshint -W09,-W1177 */
'use strict';

var LogInLink = React.createClass({

  createLoggedIn: function() {
    var url = encodeURI("/logout?redirect=" + window.location);
    var userUrl = "/u/" + this.props.loggedInUserHandle;
    return (
      <div id="user">
        <a href={userUrl} className="user">
          {this.props.loggedInUserHandle}
        </a>
        <div className="dropdown">
          <i className="fa fa-chevron-down"></i>

          <div className="dropdown-content">
            <a href={userUrl}>Notes</a>
            <span className="divider"></span>
            <a href="#">Settings</a>
            <a href="/import">Import notes</a>
            <span className="divider"></span>
            <a href={url}>Log Out</a>
          </div>
        </div>
      </div>
    );
  },

  createLoggedOut: function() {
    var twitterUrl = encodeURI("/logintwitter?redirect=" + window.location);
    return (
      <div id="user">
        <span className="user">
          Log in
        </span>
        <div className="dropdown">
          <i className="fa fa-chevron-down"></i>

          <div className="dropdown-content">
            <a href={twitterUrl}>with Twitter</a>
            <a href="/logingoogle?redirect=%2F">with Google</a>
            <a href="/logingithub?redirect=%2F">with GitHub</a>
          </div>
        </div>
      </div>
    );
  },

  render: function() {
    if (this.props.isLoggedIn) {
      return this.createLoggedIn();
    } else {
      return this.createLoggedOut();
    }
  }
});

module.exports = LogInLink;
