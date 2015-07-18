/* jshint -W097,-W117 */
'use strict';

var ni = require('./noteinfo.js');
var action = require('./action.js');

function urlifyTitle(s) {
  s = s.slice(0, 32);
  return s.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
}


var NoteBody = React.createClass({

  expand: function() {
    console.log("expand note");
  },

  collapse: function() {
    console.log("collapse this note");
  },

  createCollapseOrExpand: function(note) {
    // if a note is not partial, there's neither collapse nor exapnd
    if (!ni.IsPartial(note)) {
      return;
    }
    if (ni.IsCollapsed(note)) {
      return (
        <a href="#" onClick={this.expand()}>Expand</a>
      );
    }
    return (
      <a href="#" onClick={this.collapse}>Collapsed</a>
    );
  },

  render: function() {
    if (this.props.compact) {
      return;
    }
    var note = this.props.note;
    return (
        <div className="note-content">
          <pre className="snippet">{ni.Snippet(note)}</pre>
          {this.createCollapseOrExpand(note)}
        </div>
    );
  }

});

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

  handleTagClicked: function(e) {
    var tag = e.target.textContent.substr(1);
    action.tagSelected(tag);
  },

  createTags: function(tags) {
    if (!tags) {
      return;
    }
    var self = this;
    var tagEls = tags.map(function(tag) {
      tag = "#" + tag;
      return (
        <span className="note-tag" key={tag} onClick={self.handleTagClicked}>{tag}</span>
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
        <a className="note-action" href="#" onClick={this.handleDelUndel} title="Undelete">
          <i className="fa fa-undo"></i>
        </a>
      );
    }
    return (
      <a className="note-action" href="#" onClick={this.handleDelUndel} title="Move to Trash">
        <i className="fa fa-trash-o"></i>
      </a>
    );
  },

  createPermanentDelete: function(note) {
    if (ni.IsDeleted(note)) {
      return (
        <a className="note-action" href="#" onClick={this.handlePermanentDelete} title="Delete permanently">
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
        <a className="note-action" href="#" onClick={this.handleEdit} title="Edit note">
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
      <a className="note-action" href={url} target="_blank" title="View note">
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
    if (ni.IsDeleted) {
      return;
    }
    if (ni.IsPublic(note)) {
      return (
        <a className="note-action" href="#" onClick={this.handleMakePublicPrivate} title="Make private">
          <i className="fa fa-unlock"></i>
        </a>
      );
    } else {
      return (
        <a className="note-action" href="#" onClick={this.handleMakePublicPrivate} title="Make public">
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
        <a className="note-action note-star note-starred" href="#" onClick={this.handleStarUnstarNote} title="Unstar">
          <i className="fa fa-star"></i>
        </a>
      );
    } else {
      return (
        <a className="note-action note-star" href="#" onClick={this.handleStarUnstarNote} title="Star">
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
      <div className="note" onMouseEnter={this.mouseEnter} onMouseLeave={this.mouseLeave}>
        <div className="note-header">
          {this.createStarUnstar(note)}
          {this.createTitle(note)}
          {this.createTags(ni.Tags(note))}
          {this.createActions(note)}
        </div>
        <NoteBody compact={this.props.compact} note={note} />
      </div>
    );
  }
});

module.exports = Note;
