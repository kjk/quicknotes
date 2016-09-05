import React, { Component } from 'react';
import * as ReactDOM from 'react-dom';
import keymaster from 'keymaster';

import { toHtml } from './md';
import { linkify } from './linkify';

import Editor from './Editor';
import ImportSimpleNote from './ImportSimpleNote';
import SearchResults from './SearchResults';
import Settings from './Settings';
import TemporaryMessage from './TemporaryMessage';
import Top from './Top';

import { escapeHtml } from './utils';
import { Note, toNote, FormatText } from './Note';
import * as api from './api';
import * as action from './action';

function linkifyCb(s: any, href: any) {
  if (!href) {
    return escapeHtml(s);
  }
  return `<a href="${href}" target="_blank" rel="nofollow">${s}</a>`;
}

function linkify2(s: any) {
  return linkify(s, {
    callback: linkifyCb
  });
}

interface State {
  note?: Note;
}

export default class AppNote extends Component<any, State> {
  constructor(props?: any, context?: any) {
    super(props, context);

    this.handleSearchResultSelected = this.handleSearchResultSelected.bind(this);

    this.handleDelUndel = this.handleDelUndel.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
    this.handleEditNote = this.handleEditNote.bind(this);
    this.handleMakePublicPrivate = this.handleMakePublicPrivate.bind(this);
    this.handleReloadNotes = this.handleReloadNotes.bind(this);
    this.handlePermanentDelete = this.handlePermanentDelete.bind(this);
    this.handleStarUnstarNote = this.handleStarUnstarNote.bind(this);
    this.handleVersions = this.handleVersions.bind(this);

    this.editCurrentNote = this.editCurrentNote.bind(this);
    this.isMyNote = this.isMyNote.bind(this);
    this.setNote = this.setNote.bind(this);

    const note = toNote(gInitialNote);
    this.state = {
      note: note
    };
  }

  componentDidMount() {
    if (this.isMyNote()) {
      //keymaster('ctrl+e', this.editCurrentNote);
      keymaster('ctrl+n', () => action.editNewNote());
    }
    action.onReloadNotes(this.handleReloadNotes, this);
  }

  componentWillUnmount() {
    if (this.isMyNote()) {
      //keymaster.unbind('ctrl+e');
      keymaster.unbind('ctrl+n');
    }
    action.offAllForOwner(this);
  }

  isMyNote() {
    return gLoggedUser && gLoggedUser.HashID === gNoteUser.HashID;
  }

  // the content we have might be stale (modified in another
  // browser window), so re-get the content
  editCurrentNote() {
    const note = this.state.note;
    const id = note.HashID();
    // console.log('editCurrentNote id: ', id);
    api.getNote(id, (note: Note) => {
      // TODO: handle error
      action.editNote(note);
    });
  }

  setNote(note: Note) {
    // TODO: handle the error
    this.setState({
      note: note
    });
  }

  // sent when editor saved a note, so reload it
  handleReloadNotes(resetScroll: boolean) {
    const note = this.state.note;
    const noteID = note.HashID();
    api.getNote(noteID, (note: Note) => {
      this.setNote(note);
    });
  }

  handleSearchResultSelected(noteHashID: any) {
    // console.log('search note selected: ' + noteHashID);
    // TODO: probably should display in-line
    const url = '/n/' + noteHashID;
    const win = window.open(url, '_blank');
    win.focus();
  }

  handleEditNote(e: any) {
    e.preventDefault();
    this.editCurrentNote();
  }

  handleDoubleClick(e: any) {
    console.log('doubleclick');
    e.preventDefault();
    if (this.isMyNote()) {
      this.editCurrentNote();
    }
  }

  handleDelUndel(e: any) {
    e.preventDefault();
    const note = this.state.note;
    const noteID = note.HashID();
    if (note.IsDeleted()) {
      action.showTemporaryMessage('Undeleting note...', 500);
      api.undeleteNote(noteID, (note: any) => {
        // TODO: handle error
        action.showTemporaryMessage(`Undeleted <a href="/n/${noteID}" target="_blank">note</a>.`);
        this.setNote(note);
      });
    } else {
      action.showTemporaryMessage('Moving note to trash...', 500);
      api.deleteNote(noteID, (note: any) => {
        // TODO: handle error
        action.showTemporaryMessage(`Moved <a href="/n/${noteID}" target="_blank">note</a> to trash.`);
        this.setNote(note);
      });
    }
  }

  handlePermanentDelete(e: any) {
    e.preventDefault();
    const note = this.state.note;
    const noteID = note.HashID();
    action.showTemporaryMessage('Permanently deleting note...', 500);
    api.permanentDeleteNote(noteID, () => {
      // TODO: handle error
      // TODO: allow undoe
      action.showTemporaryMessage(`Permanently deleted note.`);
      this.setNote(null);
    });
  }

  handleMakePublicPrivate(e: any) {
    e.preventDefault();
    const note = this.state.note;
    // console.log('handleMakePublicPrivate, note.IsPublic: ', note.IsPublic());
    const noteID = note.HashID();
    if (note.IsPublic()) {
      action.showTemporaryMessage('Making note private...', 500);
      api.makeNotePrivate(noteID, (note: any) => {
        // TODO: handle error
        action.showTemporaryMessage(`Made <a href="/n/${noteID}" target="_blank">note</a> private.`);
        this.setNote(note);
      });
    } else {
      action.showTemporaryMessage('Making note public...', 500);
      api.makeNotePublic(noteID, (note: any) => {
        // TODO: handle error
        action.showTemporaryMessage(`Made <a href="/n/${noteID}" target="_blank">note</a> public.`);
        this.setNote(note);
      });
    }
  }

  handleStarUnstarNote(e: any) {
    e.preventDefault();
    const note = this.state.note;
    // console.log('handleStarUnstarNote, note.IsStarred: ', note.IsStarred());
    const noteID = note.HashID();
    if (note.IsStarred()) {
      action.showTemporaryMessage('Un-starring the note...', 500);
      api.unstarNote(noteID, (note: any) => {
        // TODO: handle error
        action.showTemporaryMessage(`Unstarred <a href="/n/${noteID}" target="_blank">note</a>.`);
        this.setNote(note);
      });
    } else {
      action.showTemporaryMessage('Starring the note...', 500);
      api.starNote(noteID, (note: any) => {
        // TODO: handle error
        action.showTemporaryMessage(`Starred <a href="/n/${noteID}" target="_blank">note</a>.`);
        this.setNote(note);
      });
    }
  }

  handleVersions(e: any) {
    e.preventDefault();
    console.log('show note versions');
  }

  renderEdit(note: any) {
    if (note.IsDeleted()) {
      return;
    }
    return <a href='#' onClick={this.handleEditNote}>Edit</a>;
  }

  renderVersions(note: any) {
    //return <a href="#" onClick={ this.handleVersions }>Versions</a>;
  }

  renderStarUnstar(note: any) {
    if (note.IsDeleted()) {
      return;
    }
    const s = note.IsStarred() ? 'Unstar' : 'Star';
    return <a href='#' onClick={this.handleStarUnstarNote}>
      {s}
    </a>;
  }

  renderMakePublicPrivate(note: any) {
    if (note.IsDeleted()) {
      return;
    }
    const s = note.IsPublic() ? 'Make private' : 'Make public';
    return <a href='#' onClick={this.handleMakePublicPrivate}>
      {s}
    </a>;
  }

  renderTrashUntrash(note: any) {
    const s = note.IsDeleted() ? 'Undelete' : 'Move to Trash';
    return <a href='#' onClick={this.handleDelUndel}>
      {s}
    </a>;
  }

  renderPermanentDelete(note: any) {
    if (note.IsDeleted()) {
      return <a href='#' onClick={this.handlePermanentDelete}>Delete permanently</a>;
    }
  }

  renderBody(note: any) {
    const body = note.GetContentDirect();
    const fmtName = note.Format();
    const isTxt = fmtName == FormatText;
    if (isTxt) {
      const html = {
        __html: linkify2(body)
      };
      return <pre onDoubleClick={this.handleDoubleClick} dangerouslySetInnerHTML={html}></pre>;
    }
    const html = {
      __html: toHtml(body)
    };

    return <div onDoubleClick={this.handleDoubleClick} dangerouslySetInnerHTML={html}></div>;
  }

  renderTags(tags: any) {
    const tagEls = tags.map((tag: any) => {
      tag = '#' + tag;
      return (
        <span className='note-tag' key={tag}>{tag}</span>
      );
    });

    return (
      <span className='note-tags'>{tagEls}</span>
    );
  }

  renderPublicPrivate(note: any) {
    const isPublic = note.IsPublic();
    if (isPublic) {
      return <span className='is-public'>public </span>;
    } else {
      return <span className='is-private'>private </span>;
    }
  }

  renderDeletedState(note: any) {
    const isDeleted = note.IsDeleted();
    if (isDeleted) {
      return <span className='is-deleted'>deleted</span>;
    }
  }

  renderNoteDeleted() {
    const nu = gNoteUser;
    const url = `/u/${nu.HashID}/${nu.Handle}`;

    return (
      <div>
        <div id='note-top'>
          <Top />
        </div>
        <div id='full-note'>
          <div className='note-content-wrapper'>
            <div className='note-deleted center'>
              This note has been permanently deleted.
            </div>
          </div>
          <hr className='light' />
          <div className='note-footer center'>
            A note by <a href={url}>{nu.Handle}</a>.
          </div>
        </div>
        <Settings />
        <SearchResults onSearchResultSelected={this.handleSearchResultSelected} />
        <ImportSimpleNote />
        <Editor />
        <TemporaryMessage />
      </div>
    );
  }

  render() {
    const note = this.state.note;
    if (!note) {
      return this.renderNoteDeleted();
    }

    // console.log('AppNote.render: gLoggedUser: ', gLoggedUser, ' note.IsPublic:', note.IsPublic());
    const title = note.Title();
    const nu = gNoteUser;
    const url = `/u/${nu.HashID}/${nu.Handle}`;
    const tags = note.Tags();

    return (
      <div>
        <div id='note-top'>
          <Top />
        </div>
        <div id='full-note'>
          <div className='note-content-wrapper'>
            <div className='full-note-top'>
              <h1>{title}</h1>
              {this.renderTags(tags)}
              {this.renderPublicPrivate(note)}
              {this.renderDeletedState(note)}
              <div className='flex-spacer'></div>
              {this.isMyNote() ?
                <div className='menu-trigger'>
                  <i className='fa fa-ellipsis-v'></i>
                  <div className='menu-content'>
                    {this.renderEdit(note)}
                    {this.renderStarUnstar(note)}
                    {this.renderMakePublicPrivate(note)}
                    {this.renderTrashUntrash(note)}
                    {this.renderPermanentDelete(note)}
                  </div>
                </div> : null}
            </div>
            {this.renderBody(note)}
          </div>
          <hr className='light' />
          <div className='note-footer center'>
            A note by <a href={url}>{nu.Handle}</a>.
          </div>
        </div>
        <Settings />
        <SearchResults onSearchResultSelected={this.handleSearchResultSelected} />
        <ImportSimpleNote />
        <Editor />
        <TemporaryMessage />
      </div>
    );
  }
}

function appNoteStart() {
  const el = document.getElementById('root');
  ReactDOM.render(<AppNote />, el);
}

window.appNoteStart = appNoteStart;
