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

    this.editCurrentNote = this.editCurrentNote.bind(this);

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

  // the content we have might be stale (modified in another
  // browser window), so re-get the content
  editCurrentNote() {
    const note = this.props.note;
    const id = ni.HashID(note);
    // console.log('editCurrentNote id: ', id);
    api.getNote(id, json => {
      // TODO: handle error
      action.editNote(json);
    });
  }

  handleDoubleClick(e) {
    e.preventDefault();
    this.editCurrentNote();
  }

  handleDelUndel(e) {
    e.preventDefault();
    const note = this.props.note;
    const noteID = ni.HashID(note);
    if (ni.IsDeleted(note)) {
      action.showTemporaryMessage('Undeleting note...', 500);
      api.undeleteNote(noteID, () => {
        // TODO: handle error
        action.showTemporaryMessage(`Undeleted <a href="/n/${noteID}" target="_blank">note</a>.`);
        action.reloadNotes(false);
      });
    } else {
      action.showTemporaryMessage('Moving note to trash...', 500);
      api.deleteNote(noteID, () => {
        // TODO: handle error
        action.showTemporaryMessage(`Moved <a href="/n/${noteID}" target="_blank">note</a> to trash.`);
        action.reloadNotes(false);
      });
    }
  }

  handlePermanentDelete(e) {
    e.preventDefault();
    const note = this.props.note;
    const noteID = ni.HashID(note);
    action.showTemporaryMessage('Permanently deleting note...', 500);
    api.permanentDeleteNote(noteID, () => {
      // TODO: handle error
      // TODO: allow undoe
      action.showTemporaryMessage(`Permanently deleted note.`);
      action.reloadNotes(false);
    });
  }

  handleMakePublicPrivate(e) {
    e.preventDefault();
    const note = this.props.note;
    // console.log('handleMakePublicPrivate, note.IsPublic: ', ni.IsPublic(note));
    const noteID = ni.HashID(note);
    if (ni.IsPublic(note)) {
      action.showTemporaryMessage('Making note private...', 500);
      api.makeNotePrivate(noteID, () => {
        // TODO: handle error
        action.showTemporaryMessage(`Made <a href="/n/${noteID}" target="_blank">note</a> private.`);
        action.reloadNotes(false);
      });
    } else {
      action.showTemporaryMessage('Making note public...', 500);
      api.makeNotePublic(noteID, () => {
        // TODO: handle error
        action.showTemporaryMessage(`Made <a href="/n/${noteID}" target="_blank">note</a> public.`);
        action.reloadNotes(false);
      });
    }
  }

  handleStarUnstarNote(e) {
    const note = this.props.note;
    // console.log('handleStarUnstarNote, note.IsStarred: ', ni.IsStarred(note));
    const noteID = ni.HashID(note);
    if (ni.IsStarred(note)) {
      action.showTemporaryMessage('Un-starring a note...', 500);
      api.unstarNote(noteID, () => {
        // TODO: handle error
        action.showTemporaryMessage(`Unstarred <a href="/n/${noteID}" target="_blank">note</a>.`);
        action.reloadNotes(false);
      });
    } else {
      action.showTemporaryMessage('Starring a note...', 500);
      api.starNote(noteID, () => {
        // TODO: handle error
        action.showTemporaryMessage(`Starred <a href="/n/${noteID}" target="_blank">note</a>.`);
        action.reloadNotes(false);
      });
    }
  }

  renderTrashUntrash(note) {
    if (ni.IsDeleted(note)) {
      return (
        <a className="note-action"
          href="#"
          onClick={ this.handleDelUndel }
          title="Undelete">undelete</a>
        );
    }
    return (
      <a className="note-action delete"
        href="#"
        onClick={ this.handleDelUndel }
        title="Move to Trash">delete</a>
      );
  }

  renderPermanentDelete(note) {
    if (ni.IsDeleted(note)) {
      return (
        <a className="note-action delete"
          href="#"
          onClick={ this.handlePermanentDelete }
          title="Delete permanently">delete permanently</a>
        );
    }
  }

  handleEdit(e) {
    // console.log('Note.handleEdit');
    this.editCurrentNote();
  }

  renderEdit(note) {
    if (!ni.IsDeleted(note)) {
      return (
        <a className="note-action"
          href="#"
          onClick={ this.handleEdit }
          title="Edit note">edit</a>
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
        title="View note">view</a>
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
          title="Make private">make private</a>
        );
    } else {
      return (
        <a className="note-action"
          href="#"
          onClick={ this.handleMakePublicPrivate }
          title="Make public">make public</a>
        );
    }
  }

  renderStarUnstar(note) {
    if (!this.props.showingMyNotes || ni.IsDeleted(note)) {
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
