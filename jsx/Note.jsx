function isSpecialTag(tag) {
  if (tag == "__public") {
    return true;
  }
  return false;
}

function urlifyTitle(s) {
  s = s.slice(0,32);
  return s.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
}

var Note = React.createClass({
  createTitle: function(note) {
    if (note.Title !== "") {
      var cls = "title tcol" + note.ColorID;
      return (
        <span className={cls}>{note.Title}</span>
        );
    };
  },

  createTags: function(tags) {
    if (tags) {
      var tagEls = tags.map(function (tag) {
        if (!isSpecialTag(tag)) {
          tag = "#" + tag
          return (
            <span key={tag} className="titletag">{tag}</span>
          )
        }
      });

      return (
        <span>{tagEls}</span>
      );
    }
  },

  mouseEnter: function(e) {
    // TODO: show delete/edit buttons
    e.preventDefault();
  },

  mouseLeave: function(e) {
    // TODO: hide delete/edit buttons
    e.preventDefault();
  },

  createNoteSnippet: function(note) {
    if (!this.props.compact) {
      return (
        <span className="message">
          <pre className="snippet">{note.Snippet}</pre>
        </span>
      );
    }
  },

  handleDelUndel: function(e) {
    console.log("handleDelUndel");
    e.preventDefault();
    //this.props.deleteNoteCb(this.props.note);
  },

  createDelUndel: function(note) {
    if (note.IsDeleted) {
      return (
        <a href="#" className="noteLink" onClick={this.handleDelUndel}>undelete</a>
      );
    }
    return (
      <a href="#" className="noteLink" onClick={this.handleDelUndel}>delete</a>
    );
  },

  handleEdit: function(e) {
    console.log("handleEdit");
    e.preventDefault();
    //this.props.editCb(this.props.note)
  },

  createEdit: function(note) {
    if (!note.IsDeleted) {
      return (
        <a href="#" className="noteLink" onClick={this.handleEdit}>edit</a>
      );
    } else {
      return (
        <span></span>
      );
    }
  },

  createViewLink: function(note) {
    var txt = "view";
    var s = {
      color: "gray",
      fontSize: "80%"
    };
    var title = "";
    if (note.Title.length > 0) {
      title = "-" + urlifyTitle(note.Title);
    }
    var url = "/n/" + note.IDStr + title;
    return (
      <span>
        <a href={url} className="noteLink" target="_blank">{txt}</a>
        &nbsp;<span style={s}>{note.HumanSize}</span>
      </span>
    );
  },

  render: function() {
    var note = this.props.note;
    return (
      <div className="one-note"
        onMouseEnter={this.mouseEnter}
        onMouseLeave={this.mouseLeave}
        >
        <div>
          {this.createTitle(note)}
          {this.createTags(note.Tags)}
          {this.createDelUndel(note)}
          {this.createEdit(note)}
          {this.createViewLink(note)}
        </div>
        {this.createNoteSnippet(note)}
      </div>
    );
  }
});

module.exports = Note
