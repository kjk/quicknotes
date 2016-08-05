/// <reference path="../typings/index.d.ts" />

import React, { Component } from 'react';
import * as ni from './noteinfo';

/*
NoteBody.propTypes = {
  note: PropTypes.array.isRequired,
  compact: PropTypes.bool.isRequired
};
*/
interface Props {
  note?: any;
  compact?: boolean;
};

interface State {
  note?: any;
  body?: string;
};

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
    if (!ni.IsExpanded(note)) {
      return;
    }
    if (!ni.NeedsExpansion(note)) {
      return;
    }
    ni.FetchLatestContent(note, (note: any, body: any) => {
      this.setState({
        note: note,
        body: body
      });
    });
  }

  handleExpand(e: any) {
    e.preventDefault();
    const note = this.state.note;
    console.log('expand note', ni.HashID(note));
    ni.Expand(note);
    this.getBodyIfNeeded(note);
  }

  handleCollapse(e: any) {
    e.preventDefault();
    const note = this.state.note;
    console.log('collapse note', ni.HashID(note));
    ni.Collapse(note);
    this.setState({
      note: note
    });
  }

  renderCollapseOrExpand(note: any) {
    // if a note is not partial, there's neither collapse nor exapnd
    if (!ni.NeedsExpansion(note)) {
      return;
    }

    if (ni.IsCollapsed(note)) {
      return (
        <a href='#' className='expand' onClick={ this.handleExpand }>Expand</a>
      );
    }

    return (
      <a href='#' className='collapse' onClick={ this.handleCollapse }>Collapse</a>
    );
  }

  renderContent(note: any) {
    const body = this.state.body;
    if (ni.IsCollapsed(note)) {
      return <pre className='note-body'>{ ni.Snippet(note) }</pre>;
    }
    // TODO: set a reasonable limit
    return <pre className='note-body'>{ body }</pre>;
  }

  render() {
    if (this.props.compact) {
      return;
    }
    const note = this.state.note;
    //console.log("NoteBody.render() note: ", ni.HashID(note), "collapsed:", ni.IsCollapsed(note));
    return (
      <div className='note-content'>
        { this.renderContent(note) }
        { this.renderCollapseOrExpand(note) }
      </div>
    );
  }
}
