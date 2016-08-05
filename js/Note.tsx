/// <reference path="../typings/index.d.ts" />

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import NoteBody from './NoteBody';
import * as ni from './noteinfo';
import * as action from './action';
import * as api from './api';

function urlifyTitle(s: string) {
  s = s.slice(0, 32);
  return s.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
}

interface State {
  showActions: boolean;
}

/*
Note.propTypes = {
  note: PropTypes.array.isRequired,
  compact: PropTypes.bool.isRequired,
  showingMyNotes: PropTypes.bool.isRequired
};
*/

interface Props {
  note: any;
  compact: boolean;
  showingMyNotes: boolean;
}

export default class Note extends Component<Props, State> {
  constructor(props?: Props, context?: any) {
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

  handleTagClicked(e: any) {
    let tag = e.target.textContent;
    if (tag.startsWith('#')) {
      tag = tag.substr(1);
    }
    const op = e.altKey ? 'toggle' : 'set';
    action.tagSelected(tag, op);
  }

  handleMouseEnter(e: any) {
    e.preventDefault();
    this.setState({
      showActions: true
    });
  }

  handleMouseLeave(e: any) {
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
    api.getNote(id, (json: any) => {
      // TODO: handle error
      action.editNote(json);
    });
  }

  handleDoubleClick(e: any) {
    e.preventDefault();
    this.editCurrentNote();
  }

  handleDelUndel(e: any) {
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

  handlePermanentDelete(e: any) {
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

  handleMakePublicPrivate(e: any) {
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

  handleStarUnstarNote(e: any) {
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

  renderTitle(note: any) {
    const title = ni.Title(note);
    if (title !== '') {
      return (
        <span className='note-title'>{ title }</span>
      );
    }
  }

  renderTags(tags: any) {
    const tagEls = tags.map((tag: any) => {
      tag = '#' + tag;
      return (
        <span className='note-tag' key={ tag } onClick={ this.handleTagClicked }>{ tag }</span>
      );
    });

    return (
      <span className='note-tags'>{ tagEls }</span>
    );
  }

  renderPublicPrivate(note: any) {
    const isPublic = ni.IsPublic(note);
    if (isPublic) {
      return <span className='is-public'>public </span>;
    } else {
      return <span className='is-private'>private </span>;
    }
  }

  renderDeletedState(note: any) {
    const isDeleted = ni.IsDeleted(note);
    if (isDeleted) {
      return <span className='is-deleted'>deleted</span>;
    }
  }

  renderTrashUntrash(note: any) {
    if (ni.IsDeleted(note)) {
      return (
        <a className='note-action'
          href='#'
          onClick={ this.handleDelUndel }
          title='Undelete'>undelete</a>
      );
    }
    return (
      <a className='note-action delete'
        href='#'
        onClick={ this.handleDelUndel }
        title='Move to Trash'>delete </a>
    );
  }

  renderPermanentDelete(note: any) {
    if (ni.IsDeleted(note)) {
      return (
        <a className='note-action delete'
          href='#'
          onClick={ this.handlePermanentDelete }
          title='Delete permanently'>delete permanently</a>
      );
    }
  }

  handleEdit(e: any) {
    // console.log('Note.handleEdit');
    this.editCurrentNote();
  }

  renderEdit(note: any) {
    if (!ni.IsDeleted(note)) {
      return (
        <a className='note-action'
          href='#'
          onClick={ this.handleEdit }
          title='Edit note'>edit</a>
      );
    }
  }

  renderViewLink(note: any) {
    let title = ni.Title(note);
    if (title.length > 0) {
      title = '-' + urlifyTitle(title);
    }
    const url = '/n/' + ni.HashID(note) + title;
    return (
      <a className='note-action'
        href={ url }
        target='_blank'
        title='View note'>view</a>
    );
  }

  renderSize(note: any) {
    return (
      <span className='note-size'>{ ni.HumanSize(note) }</span>
    );
  }

  renderMakePublicPrivate(note: any) {
    if (ni.IsDeleted(note)) {
      return;
    }
    if (ni.IsPublic(note)) {
      return (
        <a className='note-action'
          href='#'
          onClick={ this.handleMakePublicPrivate }
          title='Make private'>make private </a>
      );
    } else {
      return (
        <a className='note-action'
          href='#'
          onClick={ this.handleMakePublicPrivate }
          title='Make public'>make public </a>
      );
    }
  }

  renderStarUnstar(note: any) {
    if (!this.props.showingMyNotes || ni.IsDeleted(note)) {
      return;
    }

    const isStarred = ni.IsStarred(note);
    if (isStarred) {
      return (
        <a className='note-action note-star note-starred'
          href='#'
          onClick={ this.handleStarUnstarNote }
          title='Unstar'><i className='fa fa-star'></i></a>
      );
    } else {
      return (
        <a className='note-action note-star'
          href='#'
          onClick={ this.handleStarUnstarNote }
          title='Star'><i className='fa fa-star-o'></i></a>
      );
    }
  }

  renderActionsIfMyNotes(note: any) {
    if (this.state.showActions) {
      return (
        <div className='note-actions'>
          { this.renderTrashUntrash(note) }
          { this.renderPermanentDelete(note) }
          { this.renderMakePublicPrivate(note) }
          { this.renderEdit(note) }
          { this.renderViewLink(note) }
        </div>
      );
    }
  }

  renderActionsIfNotMyNotes(note: any) {
    if (this.state.showActions) {
      return (
        <div className='note-actions'>
          { this.renderViewLink(note) }
        </div>
      );
    }
    return (
      <div className='note-actions'></div>
    );
  }

  renderActions(note: any) {
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
        <div className='note-header'>
          { this.renderStarUnstar(note) }
          { this.renderTitle(note) }
          { this.renderTags(ni.Tags(note)) }
          { this.renderPublicPrivate(note) }
          { this.renderDeletedState(note) }
          { this.renderActions(note) }
        </div>
        <NoteBody compact={ this.props.compact } note={ note } />
      </div>
    );
  }
}
