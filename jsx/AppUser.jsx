var utils = require('./utils.js');
var NotesList = require('./NotesList.jsx');
var Top = require('./Top.jsx');
var LeftSidebar = require('./LeftSidebar.jsx');

function tagsFromNotes(notes) {
  var tags = {
    __all: 0,
    __deleted: 0
  };
  if (!notes) {
    return {};
  }
  notes.map(function (note) {
    if (note.IsDeleted) {
      tags.__deleted += 1;
      return;
    } else {
      tags.__all += 1;
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
      selectedTag: "",
      isLoggedIn: false,
      notesUserHandle: "",
      loggedInUserHandle: ""
    };
  },

  tagSelected: function(tag) {
    var selectedNotes = utils.filterNotesByTag(this.state.allNotes, tag);
    this.setState({
      selectedNotes: selectedNotes,
      selectedTag: tag
    });
  },

  updateNotes: function() {
    $.get("/api/getnotes.json?user=kjk", function(json) {
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
        notesUserHandle: json.NotesUserHandle,
        loggedInUserHandle: json.LoggedInUserHandle,
        isLoggedIn: json.LoggedInUserHandle !== "",
      });
    }.bind(this));
  },

  componentDidMount: function() {
    this.updateNotes();
  },

  createNewTextNoteCb: function(s) {
    s = s.trim();
    console.log("createNewTextNoteCb:", s);
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
        alert( "error undeleting a note" );
      });
    } else {
      console.log("delUndelNoteCb: delete");
      $.post( "/api/deletenote.json", data, function() {
        this.updateNotes();
      }.bind(this))
      .fail(function() {
        alert( "error deleting a note" );
      });
    }
  },

  render: function() {
    var compact = false;
    //var notesCount = this.state.allNotes.length;
    var showPublicTags = this.state.isLoggedIn && (this.state.notesUserHandle == this.state.loggedInUserHandle);
    return (
        <div>
            <Top isLoggedIn={this.state.isLoggedIn}
              loggedInUserHandle={this.state.loggedInUserHandle}
              notesUserHandle={this.state.notesUserHandle}
            />
            <div id="contentWrapper">
              <LeftSidebar tags={this.state.tags}
                isLoggedIn={this.state.isLoggedIn}
                showPublicTags={showPublicTags}
                onTagSelected={this.tagSelected}
              />
              <NotesList
                notes={this.state.selectedNotes}
                compact={compact}
                createNewTextNoteCb={this.createNewTextNoteCb}
                delUndelNoteCb={this.delUndelNoteCb}
              />
            </div>
        </div>
    );
  }
});

function userStart() {
  React.render(
    <AppUser />,
    document.getElementById('main')
  );
}

module.exports = userStart();
