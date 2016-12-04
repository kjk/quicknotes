import React, { Component, PropTypes } from 'react';
import * as ReactDOM from 'react-dom';
import NoteView from './NoteView';
import { Note } from './Note';

// http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html

const maxInitialNotes = 50;

function truncateNotes(notes: Note[], max: number): Note[] {
  if (max != -1 && notes && notes.length >= max) {
    return notes.slice(0, max);
  }
  return notes;
}

interface Props {
  notes: Note[];
  compact: boolean;
  showingMyNotes: boolean;
  resetScroll?: boolean;
}

interface State {
  notes: Note[];
}

export default class NotesList extends Component<Props, State> {

  maxLoadedNotes: number;

  constructor(props?: Props, context?: any) {
    super(props, context);
    this.handleScroll = this.handleScroll.bind(this);

    this.maxLoadedNotes = maxInitialNotes;

    this.state = {
      notes: truncateNotes(props.notes, this.maxLoadedNotes) || []
    };
  }

  componentWillReceiveProps(nextProps?: Props) {
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

  handleScroll(e: React.UIEvent<HTMLDivElement>) {
    e.preventDefault();
    const nShowing = this.state.notes.length;
    const total = this.props.notes.length;
    if (nShowing >= total) {
      return;
    }
    const node = e.target as Element;
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
      <div id='notes-list' onScroll={this.handleScroll}>
        <div className='wrapper'>
          {this.state.notes.map((note: any) => {
            const key = `${note.HashID()}-${note.CurrentVersion()}`;
            return <NoteView compact={this.props.compact}
              note={note}
              key={key}
              showingMyNotes={this.props.showingMyNotes} />;
          })}
        </div>
      </div>
    );
  }
}
