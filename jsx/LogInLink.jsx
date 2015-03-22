
var LogInLink = React.createClass({

  createLoggedIn: function() {
    var s = {
      marginLeft: 16
    };

    var url = encodeURI("/logout?redirect=" + window.location);
    return (
      <div className="left">
        <span className="left">
          &nbsp;Your're logged in as: {this.props.loggedInUserHandle}&nbsp;
        </span>
        <a href={url} style={s}>Log Out</a>
      </div>
    );
  },

  createLoggedOut: function() {
    var s = {
      marginLeft: 16
    };

    var twitterUrl = encodeURI("/logintwitter?redirect=" + window.location);
    return (
      <div className="left">
        <span className="left">
          &nbsp;Your're not logged in&nbsp;
        </span>
        <span style={s}>Log in: <a href={twitterUrl}>with twitter</a></span>
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
