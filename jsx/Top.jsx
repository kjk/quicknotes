/* jshint -W097 */
'use strict';

var LogInLink = require('./LogInLink.jsx');

var Top = React.createClass({

  inputKeyDown: function(e) {
    // on ESC loose focus and reset the value
    if (e.keyCode == 27) {
      e.preventDefault();
      e.target.blur();
      e.target.value = "";
      return;
    }
  },

  render: function() {
    var s1 = {
      paddingRight: 4,
      paddingLeft: 4,
      backgroundColor: "#0DBCBF",
      color: "#FFF",
      textDecoration: "none"
    };
    var s2 = {
      fontWeight: "normal",
    };
    var s3 = {
      paddingLeft: 8
    };

    // TODO: link should have a different style on hover, so it's more obvious
    // it's a link
    return (
      <div id="header">
        <div className="left">
          <a href="/" style={s1}>QuickNotes</a>
        </div>

        <div className="left" style={s3}>
          <input name="search" id="search"
            onKeyDown={this.inputKeyDown}
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
