var LogInLink = require('./LogInLink.jsx');

var Top = React.createClass({
  render: function() {
    var s1 = {
      paddingRight: 4,
      paddingLeft: 4,
      backgroundColor: "#0DBCBF",
      color: "#FFF"
    };
    var s2 = {
      fontWeight: "normal",
    };
    var s3 = {
      paddingLeft: 8
    };

    return (
      <div id="header">
        <div className="left">
          <span style={s1}>QuickNotes</span>
        </div>

        <div className="left" style={s3}>
          <input name="search" id="search"
            className="round-input input-not-focused"  type="text"
            autoComplete="off" autoCapitalize="off"
            placeholder="Search (Ctrl-F)" size="68" />
        </div>
        <LogInLink isLoggedIn={this.props.isLoggedIn}
          loggedInUserHandle={this.props.loggedInUserHandle}/>
        <div className="clear"></div>
      </div>
    );
  }
});

module.exports = Top;
