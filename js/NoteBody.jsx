import React, { PropTypes, Component } from 'react';
import * as ni from './noteinfo.js';

export default class NoteBody extends Component {
  constructor(props, context) {
    super(props, context);
    this.handleCollapse = this.handleCollapse.bind(this);
    this.handleExpand = this.handleExpand.bind(this);
    this.handleFetchedContent = this.handleFetchedContent.bind(this);

    this.state = {
      note: props.note
    };
  }

  handleExpand() {
    const note = this.state.note;
    console.log('expand note', ni.IDStr(note));
    ni.Expand(note);
    const content = ni.Content(note, this.handleFetchedContent);
    // if has content, change the state immediately.
    // if doesn't have content, it'll be changed in handleFetchedContent.
    // if we always do it and there is no content, we'll get an ugly flash
    // due to 2 updates in quick succession.
    if (content) {
      this.setState({
        note: note
      });
    }
  }

  handleCollapse() {
    const note = this.state.note;
    console.log('collapse note', ni.IDStr(note));
    ni.Collapse(note);
    this.setState({
      note: note
    });
  }

  renderCollapseOrExpand(note) {
    // if a note is not partial, there's neither collapse nor exapnd
    if (!ni.IsPartial(note)) {
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

  handleFetchedContent(note) {
    console.log('NoteBody.handleFetchedContent');
    this.setState({
      note: note
    });
  }

  renderContent(note) {
    if (ni.IsCollapsed(note)) {
      return <pre className="note-body">{ ni.Snippet(note) }</pre>;
    }
    return <pre className="note-body">{ ni.FetchContent(note, this.handleFetchedContent) }</pre>;
  }

  render() {
    if (this.props.compact) {
      return;
    }
    const note = this.state.note;
    //console.log("NoteBody.render() note: ", ni.IDStr(note), "collapsed:", ni.IsCollapsed(note));
    return (
      <div className="note-content">
        { this.renderContent(note) }
        { this.renderCollapseOrExpand(note) }
      </div>
      );
  }
}

NoteBody.propTypes = {
  note: PropTypes.array,
  compact: PropTypes.bool
};

