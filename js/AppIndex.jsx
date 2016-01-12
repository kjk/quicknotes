import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import Top from './Top.jsx';
import Settings from './Settings.jsx';
import RecentNotes from './RecentNotes.jsx';
import ImportSimpleNote from './ImportSimpleNote.jsx';
import * as action from './action.js';

export default class AppIndex extends Component {
  constructor(props, context) {
    super(props, context);

    this.hideSettings = this.hideSettings.bind(this);
    this.showSettings = this.showSettings.bind(this);
    this.handleStartNewNote = this.handleStartNewNote.bind(this);

    this.state = {
      isShowingSettings: false
    };
  }

  componentDidMount() {
    action.onShowSettings(this.showSettings, this);
    action.onHideSettings(this.hideSettings, this);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  showSettings() {
    console.log('showSettings');
    this.setState({
      isShowingSettings: true
    });
  }

  hideSettings() {
    console.log('hideSettings');
    this.setState({
      isShowingSettings: false
    });
  }

  handleStartNewNote() {
    console.log('handleStartNewNote');
  }

  render() {
    console.log('AppIndex: gLoggedInUserHandle: ', gLoggedInUserHandle);
    const isLoggedIn = gLoggedInUserHandle !== '';
    const showSettings = this.state.isShowingSettings;
    console.log('AppIndex.render: showSettings=', showSettings);
    return (
      <div>
        <Top isLoggedIn={ isLoggedIn }
          loggedInUserHandle={ gLoggedInUserHandle }
          onStartNewNote={ this.handleStartNewNote }
          notesUserHandle="" />
        { showSettings ?
          <Settings />
          : null }
        <ImportSimpleNote />
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
