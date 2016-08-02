/// <reference path="../typings/index.d.ts" />

// http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html
import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import Note from './Note';
import * as ni from './noteinfo';

const maxInitialNotes = 50;

function truncateNotes(notes, max) {
  if (max != -1 && notes && notes.length >= max) {
    return notes.slice(0, max);
  }
  return notes;
}

/*
NotesList.propTypes = {
  notes: PropTypes.array,
  compact: PropTypes.bool.isRequired,
  showingMyNotes: PropTypes.bool.isRequired,
  resetScroll: PropTypes.bool
};
*/

interface Props {
  notes: any;
  compact: boolean;
  showingMyNotes: boolean;
  resetScroll?: boolean;
}

interface State {
  notes: any;
}

export default class NotesList extends Component<Props, State> {

  maxLoadedNotes: any;

  constructor(props, context) {
    super(props, context);
    this.handleScroll = this.handleScroll.bind(this);

    this.maxLoadedNotes = maxInitialNotes;

    this.state = {
      notes: truncateNotes(props.notes, this.maxLoadedNotes) || []
    };
  }

  componentWillReceiveProps(nextProps) {
    const resetScroll = nextProps.resetScroll;
    // console.log('NotesList.componentWillReceiveProps(), resetScroll: ', resetScroll);
    if (resetScroll) {
      let node = ReactDOM.findDOMNode(this);
      node.scrollTop = 0;
      this.maxLoadedNotes = maxInitialNotes;
    }
    this.setState({
      notes: truncateNotes(nextProps.notes, this.maxLoadedNotes)
    });
  }

  handleScroll(e) {
    e.preventDefault();
    const nShowing = this.state.notes.length;
    const total = this.props.notes.length;
    if (nShowing >= total) {
      return;
    }
    const node = e.target;
    const top = node.scrollTop;
    const dy = node.scrollHeight;
    // a heuristic, maybe push it down
    const addMore = top > dy / 2;
    if (!addMore) {
      return;
    }
    //console.log("top: " + top + " height: " + dy);
    let last = nShowing + 10;
    if (last > total) {
      last = total;
    }
    let notes = this.state.notes;
    for (let i = nShowing; i < last; i++) {
      notes.push(this.props.notes[i]);
    }
    //console.log("new number of notes: " + notes.length);
    this.maxLoadedNotes = notes.length;
    this.setState({
      notes: notes,
    });
  }

  render() {
    return (
      <div id='notes-list' onScroll={ this.handleScroll }>
        <div className='wrapper'>
          { this.state.notes.map((note) => {
            const key = `${ni.HashID(note)}-${ni.CurrentVersion(note)}`;
            return <Note compact={ this.props.compact }
              note={ note }
              key={ key }
              showingMyNotes={ this.props.showingMyNotes } />;
          }) }
        </div>
      </div>
    );
  }
}
