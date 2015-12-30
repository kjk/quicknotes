import React from 'react';
import ReactDOM from 'react-dom';
import FullComposer from './FullComposer.jsx';
import LeftSidebar from './LeftSidebar.jsx';
import NotesList from './NotesList.jsx';
import Router from './Router.js';
import SearchResults from './SearchResults.jsx';
import Top from './Top.jsx';
import Settings from './Settings.jsx';
import keymaster from 'keymaster';
import _ from 'underscore';
import * as u from'./utils.js';
import * as format from './format.js';
import * as ni from './noteinfo.js';
import * as action from './action.js';

function tagsFromNotes(notes) {
  var tags = {
    __all: 0,
    __deleted: 0,
    __public: 0,
    __private: 0,
    __starred: 0,
  };
  if (!notes) {
    return {};
  }

  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];

    // a deleted note won't show up under other tags or under "all" or "public"
    if (ni.IsDeleted(note)) {
      tags.__deleted += 1;
      continue;
    }

    tags.__all += 1;
    if (ni.IsStarred(note)) {
      tags.__starred += 1;
    }

    if (ni.IsPublic(note)) {
      tags.__public += 1;
    } else {
      tags.__private += 1;
    }

    var noteTags = ni.Tags(note);
    if (noteTags !== null) {
      for (var j = 0; j < noteTags.length; j++) {
        var tag = noteTags[j];
        u.dictInc(tags, tag);
      }
    }
  }

  return tags;
}

let gSearchDelayTimerID = null;// TODO: make it variable on AppUser
// if search is in progress, this is the search term
let gCurrSearchTerm = '';

// TODO: make it variable on AppUser

export default class AppUser extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.cancelNoteEdit = this.cancelNoteEdit.bind(this);
    this.delUndelNote = this.delUndelNote.bind(this);
    this.editNote = this.editNote.bind(this);
    this.escPressed = this.escPressed.bind(this);
    this.handleSearchResultSelected = this.handleSearchResultSelected.bind(this);
    this.handleSearchTermChanged = this.handleSearchTermChanged.bind(this);
    this.handleStartNewNote = this.handleStartNewNote.bind(this);
    this.handleTagSelected = this.handleTagSelected.bind(this);
    this.hideSettings = this.hideSettings.bind(this);
    this.keyFilter = this.keyFilter.bind(this);
    this.makeNotePublicPrivate = this.makeNotePublicPrivate.bind(this);
    this.permanentDeleteNote = this.permanentDeleteNote.bind(this);
    this.saveNote = this.saveNote.bind(this);
    this.showSettings = this.showSettings.bind(this);
    this.startUnstarNote = this.startUnstarNote.bind(this);
    var initialNotesJSON = props.initialNotesJSON;
    var allNotes = [];
    var selectedNotes = [];
    var selectedTag = props.initialTag;
    var loggedInUserHandle = "";
    var tags = [];
    if (initialNotesJSON && initialNotesJSON.Notes) {
      allNotes = initialNotesJSON.Notes;
      selectedNotes = u.filterNotesByTag(allNotes, selectedTag);
      loggedInUserHandle = initialNotesJSON.LoggedInUserHandle;
      tags = tagsFromNotes(allNotes);

    }

    this.state = {
      allNotes: allNotes,
      selectedNotes: selectedNotes,
      // TODO: should be an array this.props.initialTags
      selectedTag: selectedTag,
      tags: tags,
      loggedInUserHandle: loggedInUserHandle,
      noteBeingEdited: null,
      searchResults: null,
      showingSettings: false
    };
  }

  handleTagSelected(tag) {
    //console.log("selected tag: ", tag);
    var selectedNotes = u.filterNotesByTag(this.state.allNotes, tag);
    // TODO: update url with /t:${tag}
    this.setState({
      selectedNotes: selectedNotes,
      selectedTag: tag
    });
  }

  setNotes(json) {
    var allNotes = json.Notes;
    if (!allNotes) {
      allNotes = [];
    }
    var tags = tagsFromNotes(allNotes);
    // TODO: if selectedTag is not valid, reset to __all
    var selectedTag = this.state.selectedTag;
    var selectedNotes = u.filterNotesByTag(allNotes, selectedTag);
    this.setState({
      allNotes: allNotes,
      selectedNotes: selectedNotes,
      tags: tags,
      loggedInUserHandle: json.LoggedInUserHandle
    });
  }

  updateNotes() {
    var userHandle = this.props.notesUserHandle;
    //console.log("updateNotes: userHandle=", userHandle);
    var uri = "/api/getnotescompact.json?user=" + encodeURIComponent(userHandle);
    //console.log("updateNotes: uri=", uri);
    $.get(uri, function(json) {
      this.setNotes(json);
    }.bind(this));
  }

  standardKeyFilter(event) {
    var tagName = (event.target || event.srcElement).tagName;
    return !(tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'TEXTAREA');
  }

  // by default all keypresses are filtered
  keyFilter(event) {
    if (event.keyCode == 27) {
      // allow ESC always
      return true;
    }
    return this.standardKeyFilter(event);
  }

  showSettings() {
    console.log("showSettings");
    this.setState({
      showingSettings: true
    });
  }

  hideSettings() {
    console.log("hideSettings");
    this.setState({
      showingSettings: false
    });
  }

  componentDidMount() {
    keymaster.filter = this.keyFilter;
    keymaster('ctrl+f', u.focusSearch);
    keymaster('ctrl+e', u.focusNewNote);
    keymaster('esc', this.escPressed);

    this.cidShowSettings = action.onShowSettings(this.showSettings);
    this.cidHideSettings = action.onHideSettings(this.hideSettings);
    this.cidTagSelected = action.onTagSelected(this.handleTagSelected);
  }

  componentWillUnmount() {
    key.unbind('ctrl+f', u.focusSearch);
    key.unbind('ctrl+e', u.focusNewNote);
    key.unbind('esc', this.escPressed);

    action.offShowSettings(this.cidShowSettings);
    action.offHideSettings(this.cidHideSettings);
    action.offTagSelected(this.cidTagSelected);
  }

  // TODO: after delete/undelete should show a message at the top
  // with 'undo' link
  delUndelNote(note) {
    var data = {
      noteIdHash: ni.IDStr(note)
    };
    if (ni.IsDeleted(note)) {
      $.post( "/api/undeletenote.json", data, function() {
        this.updateNotes();
      }.bind(this))
      .fail(function() {
        alert( "error undeleting a note");
      });
    } else {
      $.post( "/api/deletenote.json", data, function() {
        this.updateNotes();
      }.bind(this))
      .fail(function() {
        alert( "error deleting a note");
      });
    }
  }

  permanentDeleteNote(note) {
    var data = {
      noteIdHash: ni.IDStr(note)
    };
    $.post( "/api/permanentdeletenote.json", data, function() {
      this.updateNotes();
    }.bind(this))
    .fail(function() {
      alert( "error deleting a note");
    });
  }

  makeNotePublicPrivate(note) {
    var data = {
      noteIdHash: ni.IDStr(note)
    };
    if (ni.IsPublic(note)) {
      $.post( "/api/makenoteprivate.json", data, function() {
        this.updateNotes();
      }.bind(this))
      .fail(function() {
        alert( "error making note private");
      });
    } else {
      $.post( "/api/makenotepublic.json", data, function() {
        this.updateNotes();
      }.bind(this))
      .fail(function() {
        alert( "error making note private");
      });
    }
  }

  startUnstarNote(note) {
    var data = {
      noteIdHash: ni.IDStr(note)
    };
    if (ni.IsStarred(note)) {
      $.post( "/api/unstarnote.json", data, function() {
        this.updateNotes();
      }.bind(this))
      .fail(function() {
        alert( "error unstarring note");
      });
    } else {
      $.post( "/api/starnote.json", data, function() {
        this.updateNotes();
      }.bind(this))
      .fail(function() {
        alert( "error starring note");
      });
    }
  }

  createNewTextNote(s) {
    var note = {
      Content: s.trim(),
      Format: format.Text
    };
    var noteJSON = JSON.stringify(note);
    var data = {
      noteJSON: noteJSON
    };
    $.post( "/api/createorupdatenote.json", data, function() {
      this.updateNotes();
    }.bind(this))
    .fail(function() {
      alert( "error creating new note: " + noteJSON );
    });
  }

  saveNote(note) {
    var newNote = ni.toNewNote(note);
    newNote.Content = newNote.Content.trim();
    var noteJSON = JSON.stringify(newNote);
    this.setState({
      noteBeingEdited: null
    });
    u.clearNewNote();

    var data = {
      noteJSON: noteJSON
    };
    $.post( "/api/createorupdatenote.json", data, function() {
      this.updateNotes();
    }.bind(this))
    .fail(function() {
      alert( "error creating or updaing a note: " + noteJSON);
    });
  }

  cancelNoteEdit() {
    if (!this.state.noteBeingEdited) {
      return;
    }
    this.setState({
      noteBeingEdited: null
    });
    u.clearNewNote();
  }

  escPressed() {
    console.log("ESC pressed");
    if (this.state.noteBeingEdited) {
      this.setState({
        noteBeingEdited: null
      });
      u.clearNewNote();
      return;
    }
  }

  editNote(note) {
    var userHandle = this.props.notesUserHandle;
    var uri = "/api/getnotecompact.json?id=" + ni.IDStr(note);
    console.log("AppUser.editNote: " + ni.IDStr(note) + " uri: " + uri);

    // TODO: show an error message on error
    $.get(uri, function(noteJson) {
      this.setState({
        noteBeingEdited: noteJson
      });
    }.bind(this));
  }

  renderFullComposer() {
    if (this.state.noteBeingEdited) {
      return (
        <FullComposer
          note={this.state.noteBeingEdited}
          saveNoteCb={this.saveNote}
          cancelNoteEditCb={this.cancelNoteEdit}/>
      );
    }
  }

  renderSearchResults() {
    if (this.state.searchResults) {
      return <SearchResults
        searchResults={this.state.searchResults}
        searchResultSelectedCb={this.handleSearchResultSelected}
       />;
    }
  }

  handleStartNewNote() {
    if (this.state.noteBeingEdited !== null) {
      console.log("handleStartNewNote: a note is already being edited");
      return;
    }
    var note = {
      Content: "",
      Format: format.Text
    };
    this.setState({
      noteBeingEdited: note
    });
  }

  startSearch(userHandle, searchTerm) {
    gCurrSearchTerm = searchTerm;
    if (searchTerm === "") {
      return;
    }
    var uri = "/api/searchusernotes.json?user=" + encodeURIComponent(userHandle) + "&term=" + encodeURIComponent(searchTerm);
    $.get(uri, function(json) {
      console.log("finished search for " + json.Term);
      if (json.Term != gCurrSearchTerm) {
        console.log("discarding search results because not for " + gCurrSearchTerm);
        return;
      }
      this.setState({
        searchResults: json
      });
    }.bind(this));
  }

  handleSearchTermChanged(searchTerm) {
    gCurrSearchTerm = searchTerm;
    if (searchTerm === "") {
      // user cancelled the search
      clearTimeout(gSearchDelayTimerID);
      this.setState({
        searchResults: null
      });
      return;
    }
    // start search query with a delay to not hammer the server too much
    if (gSearchDelayTimerID) {
      clearTimeout(gSearchDelayTimerID);
    }
    var self = this;
    gSearchDelayTimerID = setTimeout(function() {
      console.log("starting search for " + searchTerm);
      self.startSearch(self.props.notesUserHandle, searchTerm);
    }, 300);
  }

  handleSearchResultSelected(noteIDStr) {
    console.log("search note selected: " + noteIDStr);
    // TODO: probably should display in-line
    var url = "/n/" + noteIDStr;
    var win = window.open(url, '_blank');
    win.focus();
    // TODO: clear search field and focus it
    this.handleSearchTermChanged(""); // hide search results
  }

  renderSettings() {
    console.log("renderSettings: ", this.state.showingSettings);
    if (this.state.showingSettings) {
      return <Settings />;
    }
  }

  render() {
    var compact = false;
    var isLoggedIn = this.state.loggedInUserHandle !== "";
    var myNotes = isLoggedIn && (this.props.notesUserHandle == this.state.loggedInUserHandle);

    return (
      <div>
        <Top isLoggedIn={isLoggedIn}
          loggedInUserHandle={this.state.loggedInUserHandle}
          startNewNoteCb={this.handleStartNewNote}
          notesUserHandle={this.props.notesUserHandle}
          searchTermChangedCb={this.handleSearchTermChanged}
        />
        <LeftSidebar tags={this.state.tags}
          isLoggedIn={isLoggedIn}
          myNotes={myNotes}
          onTagSelected={this.handleTagSelected}
          selectedTag={this.state.selectedTag}
        />
        <NotesList
          notes={this.state.selectedNotes}
          myNotes={myNotes}
          compact={compact}
          permanentDeleteNoteCb={this.permanentDeleteNote}
          delUndelNoteCb={this.delUndelNote}
          makeNotePublicPrivateCb={this.makeNotePublicPrivate}
          startUnstarNoteCb={this.startUnstarNote}
          editCb={this.editNote}
        />
        {this.renderSettings()}
        {this.renderFullComposer()}
        {this.renderSearchResults()}
      </div>
    );
  }
}


// s is in format "/t:foo/t:bar", returns ["foo", "bar"]
function tagsFromRoute(s) {
  var parts = s.split("/t:");
  var res = _.filter(parts, function(s) { return s !== ""; });
  if (res.length === 0) {
    return ["__all"];
  }
  return res;
}

function appUserStart() {
  //console.log("gNotesUserHandle: ", gNotesUserHandle);
  var initialTags = tagsFromRoute(Router.getHash());
  var initialTag = initialTags[0];
  //console.log("initialTags: " + initialTags + " initialTag: " + initialTag);
  //console.log("gInitialNotesJSON.Notes.length: ", gInitialNotesJSON.Notes.length);

  ReactDOM.render(
    <AppUser notesUserHandle={gNotesUserHandle}
      initialNotesJSON={gInitialNotesJSON}
      initialTag={initialTag}/>,
    document.getElementById('root')
  );
}

window.appUserStart = appUserStart;
