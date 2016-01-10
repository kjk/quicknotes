import React, { Component } from 'react';
import { arrNotNull } from './utils.js';

export default class RecentNotes extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      notes: gRecentNotesInitial
    };
  }

  renderNotes(notes) {
    notes = arrNotNull(notes);
    return notes.map(note => {
      // see NoteSummary in db.go for note definition
      const userHandle = note.UserHandle;
      const title = note.Title;
      const k = note.IDStr;
      const noteUrl = '/n/' + note.IDStr;
      const userUrl = '/u/' + userHandle;
      return <div key={ k }>
               <a href={ noteUrl }>
                 { title }
               </a> by&nbsp;
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

