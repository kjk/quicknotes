/* jshint -W097 */
'use strict';

var LogInLink = React.createClass({

  createLoggedIn: function() {
    var url = encodeURI("/logout?redirect=" + window.location);
    return (
      <div id="user">
        <span>
          {this.props.loggedInUserHandle}
        </span>
        <a href={url}>Log Out</a>
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
