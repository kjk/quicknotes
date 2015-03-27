/* jshint -W097 */
'use strict';

var utils = require('./utils.js');
var NotesList = require('./NotesList.jsx');
var Top = require('./Top.jsx');
var LeftSidebar = require('./LeftSidebar.jsx');

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
    return {
      allNotes: [],
      selectedNotes: [],
      selectedTag: "__all",
            loggedInUserHandle: ""
    };
  },

  handleTagSelected: function(tag) {
    console.log("selected tag: ", tag);
    var selectedNotes = utils.filterNotesByTag(this.state.allNotes, tag);
    this.setState({
      selectedNotes: selectedNotes,
      selectedTag: tag
    });
  },

  updateNotes: function() {
    // TODO: url-escape uri?
    var userHandle = this.props.notesUserHandle;
    console.log("updateNotes: userHandle=", userHandle);
    var uri = "/api/getnotes.json?user=" + userHandle;
    console.log("updateNotes: uri=", uri);
    $.get(uri, function(json) {
      var allNotes = json.Notes;
      if (!allNotes) {
        allNotes = [];
      }
      var tags = tagsFromNotes(allNotes);
      var selectedTag = this.state.selectedTag;
      var selectedNotes = utils.filterNotesByTag(allNotes, selectedTag);
      this.setState({
        allNotes: allNotes,
        selectedNotes: selectedNotes,
        tags: tags,
        loggedInUserHandle: json.LoggedInUserHandle
      });
    }.bind(this));
  },

  componentDidMount: function() {
    key('ctrl+f', utils.focusSearch);
    this.updateNotes();
  },

  componentWillUnmount: function() {
    key.unbind('ctrl+f', utils.focusSearch);
  },

  createNewTextNoteCb: function(s) {
    s = s.trim();
    var data = {
      format: "text",
      content: s
    };
    $.post( "/api/createorupdatenote.json", data, function() {
      this.updateNotes();
    }.bind(this))
    .fail(function() {
      alert( "error creating new note" );
    });
  },

  // TODO: after delete/undelete should show a message at the top
  // with 'undo' link
  delUndelNoteCb: function(note) {
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

  makeNotePublicPrivateCb: function(note) {
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

  startUnstarNoteCb: function(note) {
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

  render: function() {
    var compact = false;
    var isLoggedIn = this.state.loggedInUserHandle !== "";

    var myNotes = isLoggedIn && (this.props.notesUserHandle == this.state.loggedInUserHandle);
    return (
        <div >
            <Top isLoggedIn={isLoggedIn}
              loggedInUserHandle={this.state.loggedInUserHandle}
              notesUserHandle={this.props.notesUserHandle}
            />
            <div id="contentWrapper">
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
                createNewTextNoteCb={this.createNewTextNoteCb}
                delUndelNoteCb={this.delUndelNoteCb}
                makeNotePublicPrivateCb={this.makeNotePublicPrivateCb}
                startUnstarNoteCb={this.startUnstarNoteCb}
              />
            </div>
        </div>
    );
  }
});

function userStart() {
  console.log("gNotesUserHandle: ", gNotesUserHandle);
  React.render(
    <AppUser notesUserHandle={gNotesUserHandle}/>,
    document.getElementById('main')
  );
}

module.exports = userStart();
