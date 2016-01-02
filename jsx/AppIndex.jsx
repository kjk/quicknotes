import React from 'react';
import ReactDOM from 'react-dom';
import Top from './Top.jsx';
import Settings from './Settings.jsx';
import * as action from './action.js';
import * as u from './utils.js';

class RecentNotes extends React.Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      notes: gRecentNotesInitial
    };
  }

  renderNotes(notes) {
    notes = u.arrNotNull(notes);
    return notes.map((note) => {
      // see NoteSummary in db.go for note definition
      const userHandle = note.UserHandle;
      const title = note.Title;
      const k = note.IDStr;
      const noteUrl = '/n/' + note.IDStr;
      const userUrl = '/u/' + userHandle;
      return <div key={ k }>
               <a href={ noteUrl }>
                 { title }
               </a> by
               <a href={ userUrl }>
                 { userHandle }
               </a>
             </div>;
    });
  }

  render() {
    const notes = this.state.notes;
    return <div id="recentNotes">
             <div>
               Recent notes:
             </div>
             { this.renderNotes(notes) }
           </div>;
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
    console.log('showSettings');
    this.setState({
      showingSettings: true
    });
  }

  hideSettings() {
    console.log('hideSettings');
    this.setState({
      showingSettings: false
    });
  }

  componentDidMount() {
    action.onShowSettings(this.showSettings, this);
    action.onHideSettings(this.hideSettings, this);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  render() {
    console.log('AppIndex: gLoggedInUserHandle: ', gLoggedInUserHandle);
    const isLoggedIn = gLoggedInUserHandle !== '';
    const showSettings = this.state.showingSettings;
    return (
      <div>
        <Top isLoggedIn={ isLoggedIn } loggedInUserHandle={ gLoggedInUserHandle } notesUserHandle="" />
        { showSettings ?
          <Settings />
          : null }
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
