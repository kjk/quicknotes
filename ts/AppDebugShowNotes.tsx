import React, { Component } from 'react';
import * as ReactDOM from 'react-dom';
import * as api from './api';
import { Note } from './Note';
import moment, * as  moments from 'moment';
import filesize from 'filesize';

function fmtDate(date: Date) {
  const m = moment(date);
  return m.format('YY-MM-DD hh:mm:ss');
}

function dec2bin(n: number): string {
  return n.toString(2);
}

const styleRightAlign = {
  textAlign: 'right',
};

export default class AppDebugShowNotes extends Component<any, any> {
  constructor(props?: any, context?: any) {
    super(props, context);
    const notes: Note[] = [];
    this.state = {
      notes: notes,
    };
  }

  componentDidMount() {
    const gotNotes = (err: any, notes: Note[]) => {
      if (err) {
        console.log('AppDebugShowNotes.componentDidMount: api.getNotesCached failed with', err);
        return;
      }
      this.setState({
        notes: notes,
      });
    };

    const userHashID = gLoggedUser.HashID;
    api.getNotesCached(userHashID, gotNotes);
  }

  renderNote(note: Note) {
    const styleTitle: React.CSSProperties = {
      maxWidth: 120,
      color: 'gray',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    };

    const createdAt = fmtDate(note.CreatedAt());
    const updatedAt = fmtDate(note.UpdatedAt());
    const tagsStr = note.Tags().join(', ');
    const state: string[] = [];
    if (note.IsPublic()) {
      state.push('pub');
    }
    if (note.IsStarred()) {
      state.push('starred');
    }
    if (note.IsDeleted()) {
      state.push('deleted');
    }
    const stateStr = state.join(', ');
    const flagsStr = dec2bin(note.getFlags());
    return (<tr key={note.IDVer()}>
      <td>{note.IDVer()}</td>
      <td style={styleTitle}>{note.Title()}</td>
      <td style={styleRightAlign}>{note.Size()}</td>
      <td>{createdAt}</td>
      <td>{updatedAt}</td>
      <td>{tagsStr}</td>
      <td>{stateStr}</td>
      <td style={styleRightAlign}>{flagsStr}</td>
    </tr>);
  }

  render() {
    const styleTb: React.CSSProperties = {
      fontSize: 12,
      fontFamily: 'monospace',
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: '8px 0px',
    };
    let totalSize = 0;
    for (const n of this.state.notes) {
      totalSize += n.Size();
    }
    const totalSizeStr = filesize(totalSize);

    const notes = this.state.notes.map((n: Note) => this.renderNote(n));

    return (
      <div>
        You have {notes.length} notes, total size: {totalSizeStr}!
        <table style={styleTb}>
          <thead>
            <tr>
              <th>IdVer</th>
              <th>Title</th>
              <th>Size</th>
              <th>CreatedAt</th>
              <th>UpdatedAt</th>
              <th>Tags</th>
              <th>State</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {notes}
          </tbody>
        </table>
      </div>
    );
  }
}
