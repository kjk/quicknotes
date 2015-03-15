var NoteEdit = React.createClass({displayName: "NoteEdit",
  getInitialState: function() {
    return {visible:false};
  },

  render: function() {
    var note = this.props.note;
    if (this.state.visible) {
      return (
          React.createElement("div", {className: "btn-small note-edit", 
               onClick: this.props.editCb}, 
            "edit"
          )
      )
    } else {
      return React.createElement("div", null)
    }
  }
});

var NotePartial = React.createClass({displayName: "NotePartial",
  render: function() {
    var spanStyle = {
      color: "gray"
    };
    var note = this.props.note;
    if (note.IsPartial) {
      return (
        React.createElement("div", {className: "note-more"}, 
          React.createElement("a", {href: "/n/{note.ID}", target: "_blank"}, "more"), 
          " ", React.createElement("span", {style: spanStyle}, note.HumanSize)
        )
        )
    } else {
      return React.createElement("div", null)
    }
  }
});

var Note = React.createClass({displayName: "Note",
  createTitle: function(note) {
    if (note.Title != "") {
      var cls = "title tcol" + note.ColorID;
      return (
        React.createElement("span", {className: cls}, note.Title)
        )
    };
  },

  createTags: function(tags) {
    if (tags) {
      var tagEls = tags.map(function (tag) {
        tag = "#" + tag
        return (
          React.createElement("span", {className: "titletag"}, tag)
        )
      });
      return (
        React.createElement("span", null, tagEls)
      )
    }
  },

  editNote: function(e) {
    var note = this.props.note;
    console.log("editNote on: " + note.Title);
  },

  mouseEnter: function(e) {
    e.preventDefault();
    this.refs.editBtn.setState({visible:true});
  },

  mouseLeave: function(e) {
    e.preventDefault();
    this.refs.editBtn.setState({visible:false});
  },

  createNoteBody: function(note) {
      return (
        React.createElement(NotePartial, {note: note})
      )
    },

  createNoteSnippet: function(note) {
    if (!this.props.compact) {
      return (
        React.createElement("span", {className: "message"}, 
          React.createElement("pre", {className: "snippet"}, note.Snippet)
        )
      )
    }
  },

  render: function() {
    var note = this.props.note;
    return (
      React.createElement("div", {className: "one-note", 
        onMouseEnter: this.mouseEnter, 
        onMouseLeave: this.mouseLeave
        }, 
        React.createElement("div", null, 
          this.createTitle(note), 
          this.createTags(note.Tags)
        ), 
        this.createNoteSnippet(note), 
        React.createElement(NoteEdit, {note: note, editCb: this.editNote, ref: "editBtn"}), 
        this.createNoteBody(note)
      )
    );
  }
});

var NotesList = React.createClass({displayName: "NotesList",

  createNote: function(note) {
    return (
        React.createElement(Note, {compact: this.props.compact, note: note, key: note.ID})
      );
  },

  render: function () {
    return (
      React.createElement("div", {className: "notes-list"}, 
        React.createElement(NewNoteSmall, null), 
        this.props.notes.map(this.createNote)
      )
    );
  }
});

var NewNote = React.createClass({displayName: "NewNote",
  newNote: function(e) {
    console.log("new note");
  },

  render: function() {
    var s = {
      marginLeft: 8
    }

    return (
      React.createElement("div", {className: "left btn-small", 
        style: s, 
        onClick: this.newNote
      }, "new note")
    )
  }
});

var LogInLink = React.createClass({displayName: "LogInLink",
  render: function() {
    var s = {
      marginLeft: 16
    }
    var txt = "Log In";
    var url = encodeURI("/login?redir=" + window.location);
    if (this.props.isLoggedIn) {
      url = "/logout";
      txt = "Log Out";
    }
    return (
      React.createElement("a", {href: url, style: s}, txt)
    )
  }
});

var Top = React.createClass({displayName: "Top",
  render: function() {
    var s1 = {
      paddingRight: 4,
      paddingLeft: 4,
      backgroundColor: "#0DBCBF",
      color: "#FFF"
    };
    var s2 = {
      fontWeight: "normal",
    };
    var s3 = {
      paddingLeft: 8
    }
    return (
      React.createElement("div", {id: "header"}, 
        React.createElement("div", {className: "left"}, 
          React.createElement("span", {style: s1}, "QuickNotes")
        ), 

        React.createElement("div", {className: "left", style: s3}, 
          React.createElement("input", {name: "search", id: "search", 
            className: "round-input input-not-focused", type: "text", 
            autocomplete: "off", autocapitalize: "off", 
            placeholder: "Search (Ctrl-F)", size: "68"})
        ), 
        React.createElement("div", {className: "left"}, 
          " User: ", this.props.userName, " ", 
          React.createElement("span", {style: s2}, this.props.notesCount, " notes")
        ), 
        React.createElement(LogInLink, {isLoggedIn: this.props.isLoggedIn}), 
        React.createElement("div", {className: "clear"})
      )
    )
  }
});

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

var NewNoteSmall = React.createClass({displayName: "NewNoteSmall",
  render: function() {
    return (
        React.createElement("textarea", {
            id: "newNoteSmall", 
            placeholder: "enter new note"}
          )
    )
  }
});

var TagCount = React.createClass({displayName: "TagCount",

  click: function(e) {
    e.preventDefault();
    this.props.onTagSelected(this.props.name);
  },

  render: function() {
    return (
      React.createElement("div", {className: "tag", onClick: this.click}, 
        React.createElement("span", {className: "tagName"}, this.props.name), " ", 
        React.createElement("span", {className: "tagCount"}, this.props.count)
      )
    )
  }
});

var LeftSidebar = React.createClass({displayName: "LeftSidebar",
  render: function() {
    var tags = this.props.tags;
    if (!tags) {
      return (
        React.createElement("div", {id: "leftSidebar"}
        )
      )
    }
    var tagsArr = new Array();
    for (var key in tags) {
      var el = [key, tags[key]];
      tagsArr.push(el);
    }
    tagsArr.sort(function (a, b) {
      // sort by name, which is first element of 2-element array
      if (a[0] > b[0]) {
        return 1;
      }
      if (a[0] < b[0]) {
        return -1;
      }
      return 0;
    })
    var onTagSelected=this.props.onTagSelected;
    var tagEls = tagsArr.map(function (tagNameCount) {
      return (
        React.createElement(TagCount, {onTagSelected: onTagSelected, 
          name: tagNameCount[0], 
          count: tagNameCount[1]})
      )
    });
    return (
      React.createElement("div", {id: "leftSidebar"}, 
          tagEls
      )
    )
  }
});

function noteHasTag(note, tag) {
  var tags = note.Tags;
  if (!tags) {
    return false;
  }
  for (var i=0; i < tags.length; i++) {
    if (tags[i] == tag) {
      return true;
    }
  }
  return false;
}

function filterNotesByTag(notes, tag) {
  if (tag == "") {
    return notes;
  }
  var res = [];
  for (var i=0; i < notes.length; i++) {
    var note = notes[i];
    if (noteHasTag(note, tag)) {
      res.push(note);
    }
  }
  return res;
}

var App = React.createClass({displayName: "App",
  getInitialState: function() {
    return {
      allNotes: [],
      selectedNotes: [],
      notesCount: 0,
      selectedTag: "",
      isLoggedIn: false,
      userName: "kjk"
    };
  },

  tagSelected: function(tag) {
    var selectedNotes = filterNotesByTag(this.state.allNotes, tag);
    this.setState({
      selectedNotes: selectedNotes,
      selectedTag: tag
    });
  },

  componentDidMount: function() {
    $.get("/api/getnotes.json?user=kjk", function(json) {
      var tags = tagsFromNotes(json.Notes);
      var selectedNotes = filterNotesByTag(json.Notes, this.state.selectedTag);
      this.setState({
        allNotes: json.Notes,
        selectedNotes: selectedNotes,
        notesCount: json.NotesCount,
        tags: tags
      });
    }.bind(this));
  },

  render: function() {
    var compact = false;
    return (
        React.createElement("div", null, 
            React.createElement(Top, {isLoggedIn: this.state.isLoggedIn, 
              userName: this.state.userName, 
              notesCount: this.state.notesCount}), 
            React.createElement("div", {id: "contentWrapper"}, 
              React.createElement(LeftSidebar, {tags: this.state.tags, 
                  onTagSelected: this.tagSelected}), 
                React.createElement(NotesList, {notes: this.state.selectedNotes, compact: compact})
            )
        )
    )
  }
});

React.render(
  React.createElement(App, null),
  document.getElementById('main')
);
