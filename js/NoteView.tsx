import React, { Component } from 'react';
import * as ReactDOM from 'react-dom';
import NoteBody from './NoteBody';
import { Note } from './Note';
import * as action from './action';
import * as api from './api';

function urlifyTitle(s: string) {
  s = s.slice(0, 32);
  return s.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
}

interface State {
  showActions: boolean;
}

interface Props {
  note: Note;
  compact: boolean;
  showingMyNotes: boolean;
}

export default class NoteView extends Component<Props, State> {
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

  handleTagClicked(e: React.MouseEvent<HTMLSpanElement>) {
    e.preventDefault();
    const target = e.target as Element;
    let tag = target.textContent;
    if (tag.startsWith('#')) {
      tag = tag.substr(1);
    }
    const op = e.altKey ? 'toggle' : 'set';
    action.tagSelected(tag, op);
  }

  handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    this.setState({
      showActions: true
    });
  }

  handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    this.setState({
      showActions: false
    });
  }

  // the content we have might be stale (modified in another
  // browser window), so re-get the content
  editCurrentNote() {
    const note = this.props.note;
    const id = note.HashID();
    // console.log('editCurrentNote id: ', id);
    api.getNote(id, (err: Error, note: Note) => {
      if (err) {
        return;
      }
      action.editNote(note);
    });
  }

  handleDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    this.editCurrentNote();
  }

  handleDelUndel(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const note = this.props.note;
    const noteID = note.HashID();
    if (note.IsDeleted()) {
      action.showTemporaryMessage('Undeleting note...', 500);
      api.undeleteNote(noteID, (err: Error) => {
        if (err) {
          action.showTemporaryMessage(`Failed to delete <a href="/n/${noteID}" target="_blank">note</a>.`);
          return;
        }
        action.showTemporaryMessage(`Undeleted <a href="/n/${noteID}" target="_blank">note</a>.`);
        action.reloadNotes(false);
      });
    } else {
      action.showTemporaryMessage('Moving note to trash...', 500);
      api.deleteNote(noteID, (err: Error) => {
        if (err) {
          action.showTemporaryMessage(`Failed to move <a href="/n/${noteID}" target="_blank">note</a> to trash.`);
          return;
        }
        action.showTemporaryMessage(`Moved <a href="/n/${noteID}" target="_blank">note</a> to trash.`);
        action.reloadNotes(false);
      });
    }
  }

  handlePermanentDelete(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const note = this.props.note;
    const noteID = note.HashID();
    action.showTemporaryMessage('Permanently deleting note...', 500);
    api.permanentDeleteNote(noteID, (err: Error) => {
      if (err) {
        action.showTemporaryMessage(`Failed to permanently delete note.`);
        return;
      }
      // TODO: allow undoe
      action.showTemporaryMessage(`Permanently deleted note.`);
      action.reloadNotes(false);
    });
  }

  handleMakePublicPrivate(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const note = this.props.note;
    // console.log('handleMakePublicPrivate, note.IsPublic: ', note.IsPublic());
    const noteID = note.HashID();
    if (note.IsPublic()) {
      action.showTemporaryMessage('Making note private...', 500);
      api.makeNotePrivate(noteID, (err: Error) => {
        if (err) {
          action.showTemporaryMessage(`Failed to make <a href="/n/${noteID}" target="_blank">note</a> private.`);
          return;
        }
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

  handleStarUnstarNote(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const note = this.props.note;
    // console.log('handleStarUnstarNote, note.IsStarred: ', note.IsStarred());
    const noteID = note.HashID();
    if (note.IsStarred()) {
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

  renderTitle(note: Note) {
    const title = note.Title();
    if (title !== '') {
      return (
        <span className='note-title'>{title}</span>
      );
    }
  }

  renderTags(tags: string[]) {
    const tagEls = tags.map((tag) => {
      tag = '#' + tag;
      return (
        <span className='note-tag' key={tag} onClick={this.handleTagClicked}>{tag}</span>
      );
    });

    return (
      <span className='note-tags'>{tagEls}</span>
    );
  }

  renderPublicPrivate(note: Note) {
    const isPublic = note.IsPublic();
    if (isPublic) {
      return <span className='is-public'>public </span>;
    } else {
      return <span className='is-private'>private </span>;
    }
  }

  renderDeletedState(note: Note) {
    const isDeleted = note.IsDeleted();
    if (isDeleted) {
      return <span className='is-deleted'>deleted</span>;
    }
  }

  renderTrashUntrash(note: Note) {
    if (note.IsDeleted()) {
      return (
        <a className='note-action'
          href='#'
          onClick={this.handleDelUndel}
          title='Undelete'>undelete</a>
      );
    }
    return (
      <a className='note-action delete'
        href='#'
        onClick={this.handleDelUndel}
        title='Move to Trash'>delete </a>
    );
  }

  renderPermanentDelete(note: Note) {
    if (note.IsDeleted()) {
      return (
        <a className='note-action delete'
          href='#'
          onClick={this.handlePermanentDelete}
          title='Delete permanently'>delete permanently</a>
      );
    }
  }

  handleEdit(e: React.MouseEvent<HTMLAnchorElement>) {
    // console.log('Note.handleEdit');
    this.editCurrentNote();
  }

  renderEdit(note: Note) {
    if (!note.IsDeleted()) {
      return (
        <a className='note-action'
          href='#'
          onClick={this.handleEdit}
          title='Edit note'>edit</a>
      );
    }
  }

  renderViewLink(note: Note) {
    let title = note.Title();
    if (title.length > 0) {
      title = '-' + urlifyTitle(title);
    }
    const url = '/n/' + note.HashID() + title;
    return (
      <a className='note-action'
        href={url}
        target='_blank'
        title='View note'>view</a>
    );
  }

  renderSize(note: Note) {
    return (
      <span className='note-size'>{note.HumanSize()}</span>
    );
  }

  renderMakePublicPrivate(note: Note) {
    if (note.IsDeleted()) {
      return;
    }
    if (note.IsPublic()) {
      return (
        <a className='note-action'
          href='#'
          onClick={this.handleMakePublicPrivate}
          title='Make private'>make private </a>
      );
    } else {
      return (
        <a className='note-action'
          href='#'
          onClick={this.handleMakePublicPrivate}
          title='Make public'>make public </a>
      );
    }
  }

  renderStarUnstar(note: Note) {
    if (!this.props.showingMyNotes || note.IsDeleted()) {
      return;
    }

    const isStarred = note.IsStarred();
    if (isStarred) {
      return (
        <a className='note-action note-star note-starred'
          href='#'
          onClick={this.handleStarUnstarNote}
          title='Unstar'><i className='fa fa-star'></i></a>
      );
    } else {
      return (
        <a className='note-action note-star'
          href='#'
          onClick={this.handleStarUnstarNote}
          title='Star'><i className='fa fa-star-o'></i></a>
      );
    }
  }

  renderActionsIfMyNotes(note: Note) {
    if (this.state.showActions) {
      return (
        <div className='note-actions'>
          {this.renderTrashUntrash(note)}
          {this.renderPermanentDelete(note)}
          {this.renderMakePublicPrivate(note)}
          {this.renderEdit(note)}
          {this.renderViewLink(note)}
        </div>
      );
    }
  }

  renderActionsIfNotMyNotes(note: Note) {
    if (this.state.showActions) {
      return (
        <div className='note-actions'>
          {this.renderViewLink(note)}
        </div>
      );
    }
    return (
      <div className='note-actions'></div>
    );
  }

  renderActions(note: Note) {
    if (this.props.showingMyNotes) {
      return this.renderActionsIfMyNotes(note);
    } else {
      return this.renderActionsIfNotMyNotes(note);
    }
  }

  render() {
    const note = this.props.note;
    let cls = 'note';
    if (note.IsPrivate()) {
      cls += ' note-private';
    }
    return (
      <div className={cls}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
        onDoubleClick={this.handleDoubleClick}>
        <div className='note-header'>
          {this.renderStarUnstar(note)}
          {this.renderTitle(note)}
          {this.renderTags(note.Tags())}
          {this.renderPublicPrivate(note)}
          {this.renderDeletedState(note)}
          {this.renderActions(note)}
        </div>
        <NoteBody compact={this.props.compact} note={note} />
      </div>
    );
  }
}
