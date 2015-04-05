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
            <a href="#">Settings</a>
            <a href="#">Import notes</a>
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
        <span>
          You're not logged in
        </span>
        <span>Log in: <a href={twitterUrl}>with twitter</a></span>
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
