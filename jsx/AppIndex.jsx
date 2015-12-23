/* jshint -W097,-W117 */
'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

var action = require('./action.js');
var Top = require('./Top.jsx');
var Settings = require('./Settings.jsx');
var u = require('./utils.js');

var RecentNotes = React.createClass({
  getInitialState: function() {
    return {
      notes: gRecentNotesInitial
    };
  },

  renderNotes: function(notes) {
    notes = u.arrNotNull(notes);
    return notes.map(function(note) {
      // see NoteSummary in db.go for note definition
      var userHandle = note.UserHandle;
      var title = note.Title;
      var k = note.IDStr;
      var noteUrl = "/n/" + note.IDStr;
      var userUrl = "/u/" + userHandle;
      return <div key={k}>
        <a href={noteUrl}>{title}</a> by <a href={userUrl}>{userHandle}</a>
      </div>;
    });
  },

  render: function() {
    var notes = this.state.notes;
    return <div id="recentNotes">
      <div>Recent notes:</div>
      {this.renderNotes(notes)}</div>;
  }
});

var AppIndex = React.createClass({

  getInitialState: function() {
    return {
      showingSettings: false
    };
  },

  showSettings: function() {
    console.log("showSettings");
    this.setState({
      showingSettings: true
    });
  },

  hideSettings: function() {
    console.log("hideSettings");
    this.setState({
      showingSettings: false
    });
  },

  componentDidMount: function() {
    this.cidShowSettings = action.onShowSettings(this.showSettings);
    this.cidHideSettings = action.onHideSettings(this.hideSettings);
  },

  componentWillUnmount: function() {
    action.onShowSettings(this.cidShowSettings);
    action.onHideSettings(this.cidHideSettings);
  },

  renderSettings: function() {
    console.log("renderSettings: ", this.state.showingSettings);
    if (this.state.showingSettings) {
      return <Settings />;
    }
  },

  render: function() {
    console.log("AppIndex: gLoggedInUserHandle: ", gLoggedInUserHandle);
    var isLoggedIn = gLoggedInUserHandle !== "";
    return (
      <div>
        <Top isLoggedIn={isLoggedIn}
          loggedInUserHandle={gLoggedInUserHandle}
          notesUserHandle="" />
        {this.renderSettings()}
      </div>
    );
  }
});

function appIndexStart() {
  ReactDOM.render(
    <AppIndex />,
    document.getElementById('root')
  );
  ReactDOM.render(
    <RecentNotes />,
    document.getElementById('recent-notes-wrapper')
  );
}

window.appIndexStart = appIndexStart;
