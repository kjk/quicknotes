/* jshint -W097 */
'use strict';

var LogInLink = require('./LogInLink.jsx');

var gSearchDelayTimerID = null;
// if search is in progress, this is the search term
var gCurrSearchTerm = '';

var Top = React.createClass({

  getInitialState: function() {
    return {
      searchResults: null
    };
  },

  handleInputKeyDown: function(e) {
    // on ESC loose focus and reset the value
    if (e.keyCode == 27) {
      e.preventDefault();
      e.target.blur();
      e.target.value = "";
      gCurrSearchTerm = "";
      clearTimeout(gSearchDelayTimerID);
      return;
    }
  },

  startSearch: function(userHandle, searchTerm) {
    gCurrSearchTerm = searchTerm;
    if (searchTerm == "") {
      return;
    }
    var uri = "/api/searchusernotes.json?user=" + encodeURIComponent(userHandle) + "&term=" + encodeURIComponent(searchTerm);
    $.get(uri, function(json) {
      console.log("finished search for " + json.Term);
      if (json.Term != gCurrSearchTerm) {
        console.log("discarding search results because not for " + gCurrSearchTerm);
        return;
      }
      this.setState({
        searchResults: json
      });
    }.bind(this));
  },

  handleInputChange: function(e) {
    var searchTerm = e.target.value;
    if (gSearchDelayTimerID) {
      clearTimeout(gSearchDelayTimerID);
    }
    var self = this;
    gSearchDelayTimerID = setTimeout(function() {
      console.log("starting search for " + searchTerm);
      self.startSearch(self.props.notesUserHandle, searchTerm);
    }, 300);
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

        <div id="search-wrapper" className="left" style={s3}>
          <input name="search" id="search"
            onKeyDown={this.handleInputKeyDown}
            onChange={this.handleInputChange}
            className="round-input input-not-focused"  type="text"
            autoComplete="off" autoCapitalize="off"
            placeholder="Search (Ctrl-F)" size="68" />
        </div>
        <LogInLink isLoggedIn={this.props.isLoggedIn}
          loggedInUserHandle={this.props.loggedInUserHandle}/>
      </div>
    );
  }
});

module.exports = Top;
