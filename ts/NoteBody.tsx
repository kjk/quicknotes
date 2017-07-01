import React, { Component } from 'react';
import { Note, FetchLatestContent } from './Note';

interface Props {
  note?: Note;
  compact?: boolean;
}

interface State {
  note?: Note;
  body?: string;
}

export default class NoteBody extends Component<Props, State> {
  constructor(props?: Props, context?: any) {
    super(props, context);
    this.handleCollapse = this.handleCollapse.bind(this);
    this.handleExpand = this.handleExpand.bind(this);
    this.getBodyIfNeeded = this.getBodyIfNeeded.bind(this);

    this.state = {
      note: props.note,
      body: '',
    };
  }

  componentDidMount() {
    const note = this.props.note;
    this.getBodyIfNeeded(note);
  }

  getBodyIfNeeded(note: any) {
    if (!note.IsExpanded()) {
      return;
    }
    if (!note.NeedsExpansion()) {
      return;
    }
    FetchLatestContent(note, (note: Note, body: string) => {
      this.setState({
        note: note,
        body: body,
      });
    });
  }

  handleExpand(e: any) {
    e.preventDefault();
    const note = this.state.note;
    // console.log('expand note', note.HashID());
    note.Expand();
    this.getBodyIfNeeded(note);
  }

  handleCollapse(e: any) {
    e.preventDefault();
    const note = this.state.note;
    // console.log('collapse note', note.HashID());
    note.Collapse();
    this.setState({
      note: note,
    });
  }

  renderCollapseOrExpand(note: any) {
    // if a note is not partial, there's neither collapse nor exapnd
    if (!note.NeedsExpansion()) {
      return;
    }

    if (note.IsCollapsed()) {
      return (
        <a href="#" className="expand" onClick={this.handleExpand}>
          Expand
        </a>
      );
    }

    return (
      <a href="#" className="collapse" onClick={this.handleCollapse}>
        Collapse
      </a>
    );
  }

  renderContent(note: any) {
    const body = this.state.body;
    if (note.IsCollapsed()) {
      return (
        <pre className="note-body">
          {note.Snippet()}
        </pre>
      );
    }
    // TODO: set a reasonable limit
    return (
      <pre className="note-body">
        {body}
      </pre>
    );
  }

  render() {
    if (this.props.compact) {
      return;
    }
    const note = this.state.note;
    //console.log("NoteBody.render() note: ", note.HashID(), "collapsed:", note.IsCollapsed());
    return (
      <div className="note-content">
        {this.renderContent(note)}
        {this.renderCollapseOrExpand(note)}
      </div>
    );
  }
}
