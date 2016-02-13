'use strict';

import React, { PropTypes, Component } from 'react';
import ReactDOM from 'react-dom';
import NoteBody from './NoteBody.jsx';
import * as ni from './noteinfo.js';
import * as action from './action.js';
import * as api from './api.js';

function urlifyTitle(s) {
  s = s.slice(0, 32);
  return s.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
}

export default class Note extends Component {
  constructor(props, context) {
    super(props, context);
    this.handleDelUndel = this.handleDelUndel.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
    this.handleMakePublicPrivate = this.handleMakePublicPrivate.bind(this);
    this.handlePermanentDelete = this.handlePermanentDelete.bind(this);
    this.handleStarUnstarNote = this.handleStarUnstarNote.bind(this);
    this.handleTagClicked = this.handleTagClicked.bind(this);
    this.handleMouseEnter = this.handleMouseEnter.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);

    this.state = {
      showActions: false
    };
  }

  renderTitle(note) {
    const title = ni.Title(note);
    if (title !== '') {
      return (
        <span className="note-title">{ title }</span>
        );
    }
  }

  handleTagClicked(e) {
    let tag = e.target.textContent;
    if (tag.startsWith('#')) {
      tag = tag.substr(1);
    }
    action.tagSelected(tag);
  }

  renderTags(tags) {
    if (!tags) {
      return;
    }
    const tagEls = tags.map(tag => {
      tag = '#' + tag;
      return (
        <span className="note-tag" key={ tag } onClick={ this.handleTagClicked }>{ tag }</span>
        );
    });

    return (
      <span className="note-tags">{ tagEls }</span>
      );
  }

  handleMouseEnter(e) {
    e.preventDefault();
    this.setState({
      showActions: true
    });
  }

  handleMouseLeave(e) {
    e.preventDefault();
    this.setState({
      showActions: false
    });
  }

  handleDoubleClick(e) {
    action.editNote(this.props.note);
  }

  handleDelUndel(e) {
    e.preventDefault();
    const note = this.props.note;
    const noteId = ni.HashID(note);
    if (ni.IsDeleted(note)) {
      api.undeleteNote(noteId, () => {
        action.reloadNotes();
      });
    } else {
      api.deleteNote(noteId, () => {
        action.reloadNotes();
      });
    }
  }

  handlePermanentDelete(e) {
    e.preventDefault();
    const note = this.props.note;
    const noteId = ni.HashID(note);
    api.permanentDeleteNote(noteId, () => {
      action.reloadNotes();
    });
  }

  handleMakePublicPrivate(e) {
    e.preventDefault();
    const note = this.props.note;
    console.log('handleMakePublicPrivate, note.IsPublic: ', ni.IsPublic(note));
    const noteId = ni.HashID(note);
    if (ni.IsPublic(note)) {
      api.makeNotePrivate(noteId, () => {
        action.reloadNotes();
      });
    } else {
      api.makeNotePublic(noteId, () => {
        action.reloadNotes();
      });
    }
  }

  renderTrashUntrash(note) {
    if (ni.IsDeleted(note)) {
      return (
        <a className="note-action"
          href="#"
          onClick={ this.handleDelUndel }
          title="Undelete"><i className="fa fa-undo"></i></a>
        );
    }
    return (
      <a className="note-action"
        href="#"
        onClick={ this.handleDelUndel }
        title="Move to Trash"><i className="fa fa-trash-o"></i></a>
      );
  }

  renderPermanentDelete(note) {
    if (ni.IsDeleted(note)) {
      return (
        <a className="note-action"
          href="#"
          onClick={ this.handlePermanentDelete }
          title="Delete permanently"><i className="fa fa-trash-o"></i></a>
        );
    }
  }

  handleEdit(e) {
    console.log('Note.handleEdit');
    action.editNote(this.props.note);
  }

  renderEdit(note) {
    if (!ni.IsDeleted(note)) {
      return (
        <a className="note-action"
          href="#"
          onClick={ this.handleEdit }
          title="Edit note"><i className="fa fa-pencil"></i></a>
        );
    }
  }

  renderViewLink(note) {
    let title = ni.Title(note);
    if (title.length > 0) {
      title = '-' + urlifyTitle(title);
    }
    const url = '/n/' + ni.HashID(note) + title;
    return (
      <a className="note-action"
        href={ url }
        target="_blank"
        title="View note"><i className="fa fa-external-link"></i></a>
      );
  }

  renderSize(note) {
    return (
      <span className="note-size">{ ni.HumanSize(note) }</span>
      );
  }

  renderMakePublicPrivate(note) {
    if (ni.IsDeleted(note)) {
      return;
    }
    if (ni.IsPublic(note)) {
      return (
        <a className="note-action"
          href="#"
          onClick={ this.handleMakePublicPrivate }
          title="Make private"><i className="fa fa-unlock"></i></a>
        );
    } else {
      return (
        <a className="note-action"
          href="#"
          onClick={ this.handleMakePublicPrivate }
          title="Make public"><i className="fa fa-lock"></i></a>
        );
    }
  }

  handleStarUnstarNote(e) {
    const note = this.props.note;
    console.log('handleStarUnstarNote, note.IsStarred: ', ni.IsStarred(note));
    const noteId = ni.HashID(note);
    if (ni.IsStarred(note)) {
      api.unstarNote(noteId, () => {
        action.reloadNotes();
      });
    } else {
      api.starNote(noteId, () => {
        action.reloadNotes();
      });
    }
  }

  renderStarUnstar(note) {
    if (!this.props.showingMyNotes || ni.IsDeleted((note))) {
      return;
    }

    const isStarred = ni.IsStarred(note);
    if (isStarred) {
      return (
        <a className="note-action note-star note-starred"
          href="#"
          onClick={ this.handleStarUnstarNote }
          title="Unstar"><i className="fa fa-star"></i></a>
        );
    } else {
      return (
        <a className="note-action note-star"
          href="#"
          onClick={ this.handleStarUnstarNote }
          title="Star"><i className="fa fa-star-o"></i></a>
        );
    }
  }

  renderActionsIfMyNotes(note) {
    if (this.state.showActions) {
      return (
        <div className="note-actions">
          { this.renderTrashUntrash(note) }
          { this.renderPermanentDelete(note) }
          { this.renderMakePublicPrivate(note) }
          { this.renderEdit(note) }
          { this.renderViewLink(note) }
        </div>
        );
    }
  }

  renderActionsIfNotMyNotes(note) {
    if (this.state.showActions) {
      return (
        <div className="note-actions">
          { this.renderViewLink(note) }
        </div>
        );
    }
    return (
      <div className="note-actions"></div>
      );
  }

  renderActions(note) {
    if (this.props.showingMyNotes) {
      return this.renderActionsIfMyNotes(note);
    } else {
      return this.renderActionsIfNotMyNotes(note);
    }
  }

  render() {
    const note = this.props.note;
    let cls = 'note';
    if (ni.IsPrivate(note)) {
      cls += ' note-private';
    }
    return (
      <div className={ cls }
        onMouseEnter={ this.handleMouseEnter }
        onMouseLeave={ this.handleMouseLeave }
        onDoubleClick={ this.handleDoubleClick }>
        <div className="note-header">
          { this.renderStarUnstar(note) }
          { this.renderTitle(note) }
          { this.renderTags(ni.Tags(note)) }
          { this.renderActions(note) }
        </div>
        <NoteBody compact={ this.props.compact } note={ note } />
      </div>
      );
  }
}

Note.propTypes = {
  note: PropTypes.array.isRequired,
  compact: PropTypes.bool.isRequired,
  showingMyNotes: PropTypes.bool.isRequired
};
