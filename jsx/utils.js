/* jshint -W097 */
'use strict';

function noteHasTag(note, tag) {
  var tags = note.Tags;
  if (!tags) {
    return false;
  }
  for (var i = 0; i < tags.length; i++) {
    if (tags[i] == tag) {
      return true;
    }
  }
  return false;
}

function getSpecialNotes(notes) {
  var deletedNotes = [];
  var notDeletedNotes = [];
  var publicNotes = [];
  var privateNotes = [];
  var starredNotes = [];
  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    if (note.IsDeleted) {
      deletedNotes.push(note);
    } else {
      notDeletedNotes.push(note);
      if (note.IsPublic) {
        publicNotes.push(note);
      } else {
        privateNotes.push(note);
      }
      if (note.IsStarred) {
        starredNotes.push(note);
      }
    }
  }
  return {
    __all: notDeletedNotes,
    __deleted: deletedNotes,
    __public: publicNotes,
    __private: privateNotes,
    __starred: starredNotes
  };
}

var specialTagNames = {
  __all: "all",
  __public: "public",
  __private: "private",
  __deleted: "trash",
  __starred: "starred"
};

function isSpecialTag(tag) {
  return specialTagNames[tag];
}

function tagNameToDisplayName(tagName) {
  var translated = specialTagNames[tagName];
  if (!translated) {
    return tagName;
  }
  return translated;
}

function filterNotesByTag(notes, tag) {
  if (isSpecialTag(tag)) {
    var specialNotes = getSpecialNotes(notes);
    return specialNotes[tag];
  }

  var res = [];
  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    if (noteHasTag(note, tag)) {
      res.push(note);
    }
  }
  return res;
}

function dictInc(d, key) {
  if (d[key]) {
    d[key] += 1;
  } else {
    d[key] = 1;
  }
}

// focus "search" input area at the top of the page
function focusSearch() {
  $("#search").focus();
}

exports.filterNotesByTag = filterNotesByTag;
exports.dictInc = dictInc;
exports.focusSearch = focusSearch;
exports.tagNameToDisplayName = tagNameToDisplayName;
exports.isSpecialTag = isSpecialTag;
