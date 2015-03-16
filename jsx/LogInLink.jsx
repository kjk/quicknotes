
var LogInLink = React.createClass({
  render: function() {
    var s = {
      marginLeft: 16
    };

    var txt = "Log In";
    var url = encodeURI("/login?redir=" + window.location);
    if (this.props.isLoggedIn) {
      url = "/logout";
      txt = "Log Out";
    }
    return (
      <a href={url} style={s}>{txt}</a>
    );
  }
});

module.exports = LogInLink;
