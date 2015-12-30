import * as ni from './noteinfo.js';

export function noteHasTag(note, tag) {
  var tags = ni.Tags(note);
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
    if (ni.IsDeleted(note)) {
      deletedNotes.push(note);
    } else {
      notDeletedNotes.push(note);
      if (ni.IsPublic(note)) {
        publicNotes.push(note);
      } else {
        privateNotes.push(note);
      }
      if (ni.IsStarred(note)) {
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

const specialTagNames = {
  __all: "all",
  __public: "public",
  __private: "private",
  __deleted: "trash",
  __starred: "starred"
};

export function isSpecialTag(tag) {
  return specialTagNames[tag];
}

export function tagNameToDisplayName(tagName) {
  var translated = specialTagNames[tagName];
  if (!translated) {
    return tagName;
  }
  return translated;
}

export function filterNotesByTag(notes, tag) {
  if (isSpecialTag(tag)) {
    var specialNotes = getSpecialNotes(notes);
    return specialNotes[tag];
  }

  var res = [];
  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    if (ni.IsDeleted(note)) {
      continue;
    }
    if (noteHasTag(note, tag)) {
      res.push(note);
    }
  }
  return res;
}

export function dictInc(d, key) {
  if (d[key]) {
    d[key] += 1;
  } else {
    d[key] = 1;
  }
}

// focus "search" input area at the top of the page
export function focusSearch() {
  $("#search").focus();
}

export function focusNewNote() {
  $("#Composer").focus();
}

// TODO: should do it the react way
export function clearNewNote() {
  // TODO: this doesn't work
  $("Composer").val(null);
}
// http://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-clone-an-object
export function deepCloneObject(o) {
  return JSON.parse(JSON.stringify(o));
}

function runOnLoad(f) {
  if (window.addEventListener) {
    window.addEventListener('DOMContentLoaded', f);
  } else {
    window.attachEvent('onload', f);
  }
}

// helps to use map() in cases where the value can be null
export function arrNotNull(a) {
  return a ? a : [];
}

window.runOnLoad = runOnLoad;
