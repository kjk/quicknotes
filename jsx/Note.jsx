/* jshint -W097,-W117 */
'use strict';

function urlifyTitle(s) {
  s = s.slice(0,32);
  return s.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
}

var Note = React.createClass({

  getInitialState: function() {
    return {
      showActions: false
    };
  },

  createTitle: function(note) {
    if (note.Title !== "") {
      return (
        <span className="note-title">{note.Title}</span>
        );
    }
  },

  createTags: function(tags) {
    if (!tags) {
      return (
        <span></span>
      );
    }
    var tagEls = tags.map(function (tag) {
        tag = "#" + tag;
        return (
          <span key={tag} className="note-tag">{tag}</span>
        );
    });

    return (
      <div className="note-tags">{tagEls}</div>
    );
  },

  mouseEnter: function(e) {
    e.preventDefault();
    this.setState({
      showActions: true
    });
  },

  mouseLeave: function(e) {
    e.preventDefault();
    this.setState({
      showActions: false
    });
  },

  createNoteSnippet: function(note) {
    if (!this.props.compact) {
      return (
        <div className="note-content">
          <pre className="snippet">{note.Snippet}</pre>
        </div>
      );
    }
  },

  handleDelUndel: function(e) {
    e.preventDefault();
    this.props.delUndelNoteCb(this.props.note);
  },

  handleMakePublicPrivate: function(e) {
    e.preventDefault();
    var note = this.props.note;
    console.log("handleMakePublicPrivate, note.IsPublic: ", note.IsPublic);
    this.props.makeNotePublicPrivateCb(note);
  },

  createDelUndel: function(note) {
    if (note.IsDeleted) {
      return (
        <a href="#" className="note-action" title="Undo trash" onClick={this.handleDelUndel}>
          <i className="fa fa-undo"></i>
        </a>
      );
    }
    return (
      <a href="#" className="note-action" title="Trash note" onClick={this.handleDelUndel}>
        <i className="fa fa-trash-o"></i>
      </a>
    );
  },

  handleEdit: function(e) {
    console.log("Note.handleEdit");
    e.preventDefault();
    this.props.editCb(this.props.note);
  },

  createEdit: function(note) {
    if (!note.IsDeleted) {
      return (
        <a href="#" className="note-action" title="Edit note" onClick={this.handleEdit}>
          <i className="fa fa-pencil"></i>
        </a>
      );
    } else {
      return (
        <span></span>
      );
    }
  },

  createViewLink: function(note) {
    var title = "";
    if (note.Title.length > 0) {
      title = "-" + urlifyTitle(note.Title);
    }
    var url = "/n/" + note.IDStr + title;
    return (
      <a href={url} className="note-action" title="View note" target="_blank">
        <i className="fa fa-share"></i>
      </a>
    );
  },

  createSize: function(note) {
    return (
      <span className="note-size">{note.HumanSize}</span>
    );
  },

  createMakePublicPrivate: function(note) {
    if (note.IsPublic) {
      return (
        <a href="#" className="note-action" title="Make private" onClick={this.handleMakePublicPrivate}>
          <i className="fa fa-unlock"></i>
        </a>
      );
    } else {
      return (
        <a href="#" className="note-action" title="Make public" onClick={this.handleMakePublicPrivate}>
          <i className="fa fa-lock"></i>
        </a>
      );
    }
  },

  handleStarUnstarNote: function(e) {
    e.preventDefault();
    var note = this.props.note;
    console.log("handleStarUnstarNote, note.IsStarred: ", note.IsStarred);
    this.props.startUnstarNoteCb(note);
  },

  createStarUnstar: function(note) {
    if (!this.props.myNotes || note.IsDeleted) {
      return (<span></span>);
    }

    if (note.IsStarred) {
      return (
        <a href="#" className="note-action note-star note-starred" title="Unstar" onClick={this.handleStarUnstarNote}>
          <i className="fa fa-star"></i>
        </a>
      );
    } else {
      return (
        <a href="#" className="note-action note-star" title="Star" onClick={this.handleStarUnstarNote}>
          <i className="fa fa-star-o"></i>
        </a>
      );
    }
  },

  createActionsIfMyNotes: function(note) {
    if (this.state.showActions) {
      return (
      <div className="note-actions">
        {this.createDelUndel(note)}
        {this.createMakePublicPrivate(note)}
        {this.createEdit(note)}
        {this.createViewLink(note)}
      </div>
      );
    }
    return (
      <div className="note-actions"></div>
    );
  },

  createActionsIfNotMyNotes: function(note) {
    if (this.state.showActions) {
      return (
      <div className="note-actions">
        {this.createViewLink(note)}
      </div>
      );
    }
    return (
      <div className="note-actions"></div>
    );
  },

  createActions: function(note) {
    if (this.props.myNotes) {
        return this.createActionsIfMyNotes(note);
    } else {
      return this.createActionsIfNotMyNotes(note);
    }
  },

  render: function() {
    var note = this.props.note;
    return (
      <div className="note"
        onMouseEnter={this.mouseEnter}
        onMouseLeave={this.mouseLeave}
        >
        <div className="note-header">
          {this.createStarUnstar(note)}
          {this.createTitle(note)}
          {this.createActions(note)}
        </div>
        {this.createNoteSnippet(note)}
        <div className="note-footer">
          {this.createTags(note.Tags)}
          {this.createSize(note)}
        </div>
      </div>
    );
  }
});

module.exports = Note;
