/* jshint -W097,-W117 */
'use strict';

var _ = require('./underscore.js');
var utils = require('./utils.js');
var format = require('./format.js');
var ni = require('./noteinfo.js');

var Composer = require('./Composer.jsx');
var FullComposer = require('./FullComposer.jsx');
var LeftSidebar = require('./LeftSidebar.jsx');
var NotesList = require('./NotesList.jsx');
var Router = require('./Router.js');
var SearchResults = require('./SearchResults.jsx');
var Top = require('./Top.jsx');

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

  notes.map(function (note) {
    // a deleted note won't show up under other tags or under "all" or "public"
    if (ni.IsDeleted(note)) {
      tags.__deleted += 1;
      return;
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

    if (ni.Tags(note)) {
      ni.Tags(note).map(function (tag) {
        utils.dictInc(tags, tag);
      });
    }
  });

  return tags;
}

var gSearchDelayTimerID = null; // TODO: make it variable on AppUser
// if search is in progress, this is the search term
var gCurrSearchTerm = ''; // TODO: make it variable on AppUser

var AppUser = React.createClass({
  getInitialState: function() {
    var initialNotesJSON = this.props.initialNotesJSON;
    var allNotes = [];
    if (initialNotesJSON && initialNotesJSON.Notes) {
      allNotes = initialNotesJSON.Notes;
    }
    return {
      allNotes: allNotes,
      selectedNotes: [],
      // TODO: should be an array this.props.initialTags
      selectedTag: this.props.initialTag,
      loggedInUserHandle: "",
      noteBeingEdited: null,
      searchResults: null
    };
  },

  handleTagSelected: function(tag) {
    //console.log("selected tag: ", tag);
    var selectedNotes = utils.filterNotesByTag(this.state.allNotes, tag);
    // TODO: update url with /t:${tag}
    this.setState({
      selectedNotes: selectedNotes,
      selectedTag: tag
    });
  },

  setNotes: function(json) {
    var allNotes = json.Notes;
    if (!allNotes) {
      allNotes = [];
    }
    var tags = tagsFromNotes(allNotes);
    // TODO: if selectedTag is not valid, reset to __all
    var selectedTag = this.state.selectedTag;
    var selectedNotes = utils.filterNotesByTag(allNotes, selectedTag);
    this.setState({
      allNotes: allNotes,
      selectedNotes: selectedNotes,
      tags: tags,
      loggedInUserHandle: json.LoggedInUserHandle
    });
  },

  updateNotes: function() {
      var userHandle = this.props.notesUserHandle;
    //console.log("updateNotes: userHandle=", userHandle);
    var uri = "/api/getnotescompact.json?user=" + encodeURIComponent(userHandle);
    //console.log("updateNotes: uri=", uri);
    $.get(uri, function(json) {
      this.setNotes(json);
    }.bind(this));
  },

  standardKeyFilter: function(event) {
    var tagName = (event.target || event.srcElement).tagName;
    return !(tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'TEXTAREA');
  },

  // by default all keypresses are filtered
  keyFilter: function(event) {
    if (event.keyCode == 27) {
      // allow ESC always
      return true;
    }
    return this.standardKeyFilter(event);
  },

  componentDidMount: function() {
    key.filter = this.keyFilter;
    key('ctrl+f', utils.focusSearch);
    key('ctrl+e', utils.focusNewNote);
    key('esc', this.escPressed);
    this.updateNotes();
  },

  componentWillUnmount: function() {
    key.unbind('ctrl+f', utils.focusSearch);
    key.unbind('ctrl+e', utils.focusNewNote);
    key.unbind('esc', this.escPressed);
  },

  // TODO: after delete/undelete should show a message at the top
  // with 'undo' link
  delUndelNote: function(note) {
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
  },

  permanentDeleteNote: function(note) {
    console.log("permanentDeleteNote");
    var data = {
      noteIdHash: ni.IDStr(note)
    };
    $.post( "/api/permanentdeletenote.json", data, function() {
      this.updateNotes();
    }.bind(this))
    .fail(function() {
      alert( "error deleting a note");
    });
  },

  makeNotePublicPrivate: function(note) {
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
  },

  startUnstarNote: function(note) {
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
  },

  createNewTextNote: function(s) {
    var note = {
      Content: s.trim(),
      Format: format.Text
    };
    var noteJSON = JSON.stringify(note);
    var data = {
      noteJSON: noteJSON
    };
    $.post( "/api/createorupdatenote.json", data, function() {
      console.log("created a new note: " + noteJSON);
      this.updateNotes();
    }.bind(this))
    .fail(function() {
      alert( "error creating new note: " + noteJSON );
    });
  },

  saveNote: function(note) {
    var newNote = ni.toNewNote(note);
    newNote.Content = newNote.Content.trim();
    var noteJSON = JSON.stringify(newNote);
    console.log("saveNote: " + noteJSON);
    this.setState({
      noteBeingEdited: null
    });
    utils.clearNewNote();

    var data = {
      noteJSON: noteJSON
    };
    $.post( "/api/createorupdatenote.json", data, function() {
      console.log("note has been saved: " + noteJSON);
      this.updateNotes();
    }.bind(this))
    .fail(function() {
      alert( "error creating or updaing a note: " + noteJSON);
    });
  },

  cancelNoteEdit: function() {
    if (!this.state.noteBeingEdited) {
      return;
    }
    this.setState({
      noteBeingEdited: null
    });
    utils.clearNewNote();
  },

  escPressed: function() {
    console.log("ESC pressed");
    if (this.state.noteBeingEdited) {
      this.setState({
        noteBeingEdited: null
      });
      utils.clearNewNote();
      return;
    }
  },

  editNote: function(note) {
    var userHandle = this.props.notesUserHandle;
    var uri = "/api/getnotecompact.json?id=" + ni.IDStr(note);
    console.log("AppUser.editNote: " + ni.IDStr(note) + " uri: " + uri);

    // TODO: show an error message on error
    $.get(uri, function(noteJson) {
      this.setState({
        noteBeingEdited: noteJson
      });
    }.bind(this));
  },

  createFullComposer: function() {
    if (this.state.noteBeingEdited) {
      return (
        <FullComposer
          note={this.state.noteBeingEdited}
          saveNoteCb={this.saveNote}
          cancelNoteEditCb={this.cancelNoteEdit}/>
      );
    }
  },

  createSearchResults: function() {
    if (this.state.searchResults) {
      return <SearchResults
        searchResults={this.state.searchResults}
        searchResultSelectedCb={this.handleSearchResultSelected}
       />;
    }
  },

  handleStartNewNote: function() {
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
  },

  startSearch: function(userHandle, searchTerm) {
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
  },

  handleSearchTermChanged: function(searchTerm) {
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
  },

  handleSearchResultSelected: function(noteIDStr) {
    console.log("search note selected: " + noteIDStr);
    // TODO: probably should display in-line
    var url = "/n/" + noteIDStr;
    var win = window.open(url, '_blank');
    win.focus();
    // TODO: clear search field and focus it
    this.handleSearchTermChanged(""); // hide search results
  },

  render: function() {
    var compact = false;
    var isLoggedIn = this.state.loggedInUserHandle !== "";

    var myNotes = isLoggedIn && (this.props.notesUserHandle == this.state.loggedInUserHandle);
    return (
        <div>
            <Top isLoggedIn={isLoggedIn}
              loggedInUserHandle={this.state.loggedInUserHandle}
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
          <Composer
            startNewNoteCb={this.handleStartNewNote}
            createNewTextNoteCb={this.createNewTextNote}/>
          {this.createFullComposer()}
          {this.createSearchResults()}
        </div>
    );
  }
});


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
  console.log("initialTags: " + initialTags + " initialTag: " + initialTag);

  React.render(
    <AppUser notesUserHandle={gNotesUserHandle}
      initialNotesJSON={gInitialNotesJSON}
      initialTag={initialTag}/>,
    document.getElementById('root')
  );
}

window.appUserStart = appUserStart;

module.exports = AppUser;
