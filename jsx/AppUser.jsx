/* jshint -W097,-W117 */
'use strict';

var utils = require('./utils.js');
var format = require('./format.js');
var NotesList = require('./NotesList.jsx');
var Top = require('./Top.jsx');
var LeftSidebar = require('./LeftSidebar.jsx');
var Composer = require('./Composer.jsx');
var FullComposer = require('./FullComposer.jsx');
var Router = require('./Router.js');
var _ = require('./underscore.js');

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
    if (note.IsDeleted) {
      tags.__deleted += 1;
      return;
    }

    tags.__all += 1;
    if (note.IsStarred) {
      tags.__starred += 1;
    }

    if (note.IsPublic) {
      tags.__public += 1;
    } else {
      tags.__private += 1;
    }

    if (note.Tags) {
      note.Tags.map(function (tag) {
        utils.dictInc(tags, tag);
      });
    }
  });

  return tags;
}

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
      noteBeingEdited: null
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
    // TODO: url-escape uri?
    var userHandle = this.props.notesUserHandle;
    //console.log("updateNotes: userHandle=", userHandle);
    var uri = "/api/getnotes.json?user=" + userHandle;
    //console.log("updateNotes: uri=", uri);
    $.get(uri, function(json) {
      this.setNotes(json);
    }.bind(this));
  },

  standardKeyFilter: function(event) {
    var tagName = (event.target || event.srcElement).tagName;
    return !(tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'TEXTAREA');
  },

  // by default keypresses are not
  keyFilter: function(event) {
    console.log("keyFilter: " + event);
    if (event.keyCode == 27) { // esc
      return true;
    }
    return this.standardKeyFilter(event);
  },

  componentDidMount: function() {
    key.filter = this.keyFilter;
    key('ctrl+f', utils.focusSearch);
    key('ctrl+e', utils.focusNewNote);
    key('esc', this.cancelNoteEdit);
    this.updateNotes();
  },

  componentWillUnmount: function() {
    key.unbind('ctrl+f', utils.focusSearch);
    key.unbind('ctrl+e', utils.focusNewNote);
    key.unbind('esc', this.cancelNoteEdit);
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

  // TODO: after delete/undelete should show a message at the top
  // with 'undo' link
  delUndelNote: function(note) {
    var data = {
      noteIdHash: note.IDStr
    };
    if (note.IsDeleted) {
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
      noteIdHash: note.IDStr
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
      noteIdHash: note.IDStr
    };
    if (note.IsPublic) {
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
      noteIdHash: note.IDStr
    };
    if (note.IsStarred) {
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

  saveNote: function(note) {
    note.Content = note.Content.trim();
    var noteJSON = JSON.stringify(note);
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
    console.log("cancelNoteEdit");
    if (!this.state.noteBeingEdited) {
      return;
    }
    this.setState({
      noteBeingEdited: null
    });
    utils.clearNewNote();
  },

  editNote: function(note) {
    var userHandle = this.props.notesUserHandle;
    var uri = "/api/getnote.json?id=" + note.IDStr;
    console.log("AppUser.editNote: " + note.IDStr + " uri: " + uri);

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
      )
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

  render: function() {
    var compact = false;
    var isLoggedIn = this.state.loggedInUserHandle !== "";

    var myNotes = isLoggedIn && (this.props.notesUserHandle == this.state.loggedInUserHandle);
    var fullComposer = this.createFullComposer();
    return (
        <div>
            <Top isLoggedIn={isLoggedIn}
              loggedInUserHandle={this.state.loggedInUserHandle}
              notesUserHandle={this.props.notesUserHandle}
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
            {fullComposer}
        </div>
    );
  }
});


// s is in format "/t:foo/t:bar", returns ["foo", "bar"]
function tagsFromRoute(s) {
  var parts = s.split("/t:");
  var res = _.filter(parts, function(s) { return s != ""; });
  if (res.length == 0) {
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
