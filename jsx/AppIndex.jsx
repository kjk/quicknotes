import React from 'react';
import ReactDOM from 'react-dom';
import action from './action.js';
import Top from './Top.jsx';
import Settings from './Settings.jsx';
import u from './utils.js';

class RecentNotes extends React.Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      notes: gRecentNotesInitial
    };
  }

  renderNotes(notes) {
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
  }

  render() {
    var notes = this.state.notes;
    return <div id="recentNotes">
      <div>Recent notes:</div>
      {this.renderNotes(notes)}</div>;
  }
}

class AppIndex extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.hideSettings = this.hideSettings.bind(this);
    this.showSettings = this.showSettings.bind(this);

    this.state = {
      showingSettings: false
    };
  }

  showSettings() {
    console.log("showSettings");
    this.setState({
      showingSettings: true
    });
  }

  hideSettings() {
    console.log("hideSettings");
    this.setState({
      showingSettings: false
    });
  }

  componentDidMount() {
    this.cidShowSettings = action.onShowSettings(this.showSettings);
    this.cidHideSettings = action.onHideSettings(this.hideSettings);
  }

  componentWillUnmount() {
    action.onShowSettings(this.cidShowSettings);
    action.onHideSettings(this.cidHideSettings);
  }

  renderSettings() {
    console.log("renderSettings: ", this.state.showingSettings);
    if (this.state.showingSettings) {
      return <Settings />;
    }
  }

  render() {
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
}

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
