import React, { Component } from 'react';
import NotesList from './NotesList';
import { INote } from './noteinfo';

interface State {
  notes: INote[];
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
