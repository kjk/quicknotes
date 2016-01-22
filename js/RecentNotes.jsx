import React, { Component } from 'react';
import NotesList from './NotesList.jsx';

export default class RecentNotes extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      notes: gRecentNotesInitial
    };
  }

  render() {
    const notes = this.state.notes;
    return (
      <div id="recentNotes">
        <div>
          Recent notes:
        </div>
        <NotesList notes={ notes } compact={ false } myNotes={ false } />
      </div>
      );
  }
}
