/* jshint -W097,-W117 */
'use strict';

var ni = require('./noteinfo.js');

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
    var title = ni.Title(note);
    if (title !== "") {
      return (
        <span className="note-title">{title}</span>
        );
    }
  },

  createTags: function(tags) {
    if (!tags) {
      return;
    }
    var tagEls = tags.map(function (tag) {
        tag = "#" + tag;
        return (
          <span key={tag} className="note-tag">{tag}</span>
        );
    });

    return (
      <span className="note-tags">{tagEls}</span>
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
          <pre className="snippet">{ni.Snippet(note)}</pre>
        </div>
      );
    }
  },

  handleDelUndel: function(e) {
    this.props.delUndelNoteCb(this.props.note);
  },

  handlePermanentDelete: function() {
    this.props.permanentDeleteNoteCb(this.props.note);
  },

  handleMakePublicPrivate: function(e) {
    var note = this.props.note;
    console.log("handleMakePublicPrivate, note.IsPublic: ", ni.IsPublic(note));
    this.props.makeNotePublicPrivateCb(note);
  },

  createTrashUntrash: function(note) {
    if (ni.IsDeleted(note)) {
      return (
        <a href="#" className="note-action" title="Undelete" onClick={this.handleDelUndel}>
          <i className="fa fa-undo"></i>
        </a>
      );
    }
    return (
      <a href="#" className="note-action" title="Move to Trash" onClick={this.handleDelUndel}>
        <i className="fa fa-trash-o"></i>
      </a>
    );
  },

  createPermanentDelete: function(note) {
    if (ni.IsDeleted(note)) {
      return (
        <a href="#" className="note-action" title="Delete permanently" onClick={this.handlePermanentDelete}>
          <i className="fa fa-trash-o"></i>
        </a>
      );
    }
  },

  handleEdit: function(e) {
    console.log("Note.handleEdit");
    this.props.editCb(this.props.note);
  },

  createEdit: function(note) {
    if (!ni.IsDeleted(note)) {
      return (
        <a href="#" className="note-action" title="Edit note" onClick={this.handleEdit}>
          <i className="fa fa-pencil"></i>
        </a>
      );
    }
  },

  createViewLink: function(note) {
    var title = ni.Title(note);
    if (title.length > 0) {
      title = "-" + urlifyTitle(title);
    }
    var url = "/n/" + ni.IDStr(note) + title;
    return (
      <a href={url} className="note-action" title="View note" target="_blank">
        <i className="fa fa-external-link"></i>
      </a>
    );
  },

  createSize: function(note) {
    return (
      <span className="note-size">{ni.HumanSize(note)}</span>
    );
  },

  createMakePublicPrivate: function(note) {
    if (ni.IsPublic(note)) {
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
    var note = this.props.note;
    console.log("handleStarUnstarNote, note.IsStarred: ", ni.IsStarred(note));
    this.props.startUnstarNoteCb(note);
  },

  createStarUnstar: function(note) {
    if (!this.props.myNotes || ni.IsDeleted((note))) {
      return;
    }

    var isStarred = ni.IsStarred(note);
    if (isStarred) {
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
          {this.createTrashUntrash(note)}
          {this.createPermanentDelete(note)}
          {this.createMakePublicPrivate(note)}
          {this.createEdit(note)}
          {this.createViewLink(note)}
        </div>
      );
    }
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
          {this.createTags(ni.Tags(note))}
          {this.createActions(note)}
        </div>
        {this.createNoteSnippet(note)}
      </div>
    );
  }
});

module.exports = Note;
