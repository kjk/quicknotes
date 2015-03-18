var utils = require('./utils.js');
var NotesList = require('./NotesList.jsx');
var Top = require('./Top.jsx');
var LeftSidebar = require('./LeftSidebar.jsx');

function tagsFromNotes(notes) {
  var tags = {};
  notes.map(function (note) {
    if (note.Tags) {
      note.Tags.map(function (tag) {
        if (tags[tag]) {
          tags[tag] = tags[tag] + 1;
        } else {
          tags[tag] = 1;
        }
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
      notesCount: 0,
      selectedTag: "",
      isLoggedIn: false,
      notesUserHandle: "",
      loggedInUserHandle: ""
    }
  },

  tagSelected: function(tag) {
    var selectedNotes = utils.filterNotesByTag(this.state.allNotes, tag);
    this.setState({
      selectedNotes: selectedNotes,
      selectedTag: tag
    });
  },

  componentDidMount: function() {
    $.get("/api/getnotes.json?user=kjk", function(json) {
      var tags = tagsFromNotes(json.Notes);
      var selectedNotes = utils.filterNotesByTag(json.Notes, this.state.selectedTag);
      this.setState({
        allNotes: json.Notes,
        selectedNotes: selectedNotes,
        notesCount: json.NotesCount,
        tags: tags,
        notesUserHandle: json.NotesUserHandle,
        loggedInUserHandle: json.LoggedInUserHandle,
        isLoggedIn: json.LoggedInUserHandle != "",
      });
    }.bind(this));
  },

  render: function() {
    var compact = false;
    return (
        <div>
            <Top isLoggedIn={this.state.isLoggedIn}
              loggedInUserHandle={this.state.loggedInUserHandle}
              notesUserHandle={this.state.notesUserHandle}
              notesCount={this.state.notesCount}/>
            <div id="contentWrapper">
              <LeftSidebar tags={this.state.tags}
                  onTagSelected={this.tagSelected}/>
                <NotesList notes={this.state.selectedNotes} compact={compact}/>
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
