'use strict';

import React, { PropTypes, Component } from 'react';
import * as ni from './noteinfo.js';

export default class NoteBody extends Component {
  constructor(props, context) {
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

  getBodyIfNeeded(note) {
    if (!ni.IsExpanded(note)) {
      return;
    }
    if (!ni.NeedsExpansion(note)) {
      return;
    }
    ni.FetchLatestContent(note, (note, body) => {
      this.setState({
        note: note,
        body: body
      });
    });
  }

  handleExpand(e) {
    e.preventDefault();
    const note = this.state.note;
    console.log('expand note', ni.HashID(note));
    ni.Expand(note);
    this.getBodyIfNeeded(note);
  }

  handleCollapse(e) {
    e.preventDefault();
    const note = this.state.note;
    console.log('collapse note', ni.HashID(note));
    ni.Collapse(note);
    this.setState({
      note: note
    });
  }

  renderCollapseOrExpand(note) {
    // if a note is not partial, there's neither collapse nor exapnd
    if (!ni.NeedsExpansion(note)) {
      return;
    }

    if (ni.IsCollapsed(note)) {
      return (
        <a href="#" className="expand" onClick={ this.handleExpand }>Expand</a>
        );
    }

    return (
      <a href="#" className="collapse" onClick={ this.handleCollapse }>Collapse</a>
      );
  }

  renderContent(note) {
    const body = this.state.body;
    if (ni.IsCollapsed(note)) {
      return <pre className="note-body">{ ni.Snippet(note) }</pre>;
    }
    // TODO: set a reasonable limit
    return <pre className="note-body">{ body }</pre>;
  }

  render() {
    if (this.props.compact) {
      return;
    }
    const note = this.state.note;
    //console.log("NoteBody.render() note: ", ni.HashID(note), "collapsed:", ni.IsCollapsed(note));
    return (
      <div className="note-content">
        { this.renderContent(note) }
        { this.renderCollapseOrExpand(note) }
      </div>
      );
  }
}

NoteBody.propTypes = {
  note: PropTypes.array.isRequired,
  compact: PropTypes.bool.isRequired
};

