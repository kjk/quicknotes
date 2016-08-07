import React, { Component } from 'react';
import NotesList from './NotesList';

interface State {
  notes: any;
}

export default class RecentNotes extends Component<{}, State> {
  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      notes: gRecentNotesInitial
    };
  }

  render() {
    const notes = this.state.notes;
    return (
      <div id='recentNotes'>
        <div>
          Recent notes:
        </div>
        <NotesList notes={ notes } compact={ false } showingMyNotes={ false } />
      </div>
    );
  }
}
