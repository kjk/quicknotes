var utils = require('./utils.js');
var Note = require('./Note.jsx');

var NotesList = React.createClass({

  createNote: function(note) {
    return (
        <Note compact={this.props.compact} note={note} key={note.ID}/>
      );
  },

  render: function () {
    return (
      <div className="notes-list">
        <NewNoteSmall />
        {this.props.notes.map(this.createNote)}
      </div>
    );
  }
});

/*
var NewNote = React.createClass({
  newNote: function() {
    console.log("new note");
  },

  render: function() {
    var s = {
      marginLeft: 8
    }

    return (
      <div className="left btn-small"
        style={s}
        onClick={this.newNote}
      >new note</div>
    );
  }
});
*/

var LogInLink = React.createClass({
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
      <a href={url} style={s}>{txt}</a>
    );
  }
});

var Top = React.createClass({
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
      <div id="header">
        <div className="left">
          <span style={s1}>QuickNotes</span>
        </div>

        <div className="left" style={s3}>
          <input name="search" id="search"
            className="round-input input-not-focused"  type="text"
            autocomplete="off" autocapitalize="off"
            placeholder="Search (Ctrl-F)" size="68" />
        </div>
        <div className="left">
          &nbsp;User: {this.props.userName}&nbsp;
          <span style={s2}>{this.props.notesCount} notes</span>
        </div>
        <LogInLink isLoggedIn={this.props.isLoggedIn}/>
        <div className="clear"></div>
      </div>
    );
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

var NewNoteSmall = React.createClass({
  render: function() {
    return (
        <textarea
            id="newNoteSmall"
            placeholder="enter new note"
          />
      );
  }
});

var TagCount = React.createClass({

  click: function(e) {
    e.preventDefault();
    this.props.onTagSelected(this.props.name);
  },

  render: function() {
    return (
      <div className="tag" onClick={this.click}>
        <span className="tagName">{this.props.name}</span>&nbsp;
        <span className="tagCount">{this.props.count}</span>
      </div>
    );
  }
});

var LeftSidebar = React.createClass({
  render: function() {
    var tags = this.props.tags;
    if (!tags) {
      return (
        <div id="leftSidebar">
        </div>
      );
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
        <TagCount onTagSelected={onTagSelected}
          name={tagNameCount[0]}
          count={tagNameCount[1]} />
      )
    });
    return (
      <div id="leftSidebar">
          {tagEls}
      </div>
    );
  }
});

var AppUser = React.createClass({
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
        tags: tags
      });
    }.bind(this));
  },

  render: function() {
    var compact = false;
    return (
        <div>
            <Top isLoggedIn={this.state.isLoggedIn}
              userName={this.state.userName}
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

// TODO: should be in user.html
userStart();
