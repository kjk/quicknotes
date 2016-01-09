import * as ni from './noteinfo.js';

export function noteHasTag(note, tag) {
  const tags = ni.Tags(note);
  if (!tags) {
    return false;
  }
  for (let tag2 of tags) {
    if (tag2 == tag) {
      return true;
    }
  }
  return false;
}

function getSpecialNotes(notes) {
  let deletedNotes = [];
  let notDeletedNotes = [];
  let publicNotes = [];
  let privateNotes = [];
  let starredNotes = [];
  for (let note of notes) {
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
  __all: 'all',
  __public: 'public',
  __private: 'private',
  __deleted: 'trash',
  __starred: 'starred'
};

export function isSpecialTag(tag) {
  return specialTagNames[tag];
}

export function tagNameToDisplayName(tagName) {
  const translated = specialTagNames[tagName];
  if (!translated) {
    return tagName;
  }
  return translated;
}

export function filterNotesByTag(notes, tag) {
  if (isSpecialTag(tag)) {
    const specialNotes = getSpecialNotes(notes);
    return specialNotes[tag];
  }

  let res = [];
  for (let note of notes) {
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
  console.log('focusSearch');
  const el = document.getElementById('search');
  el.focus();
}

export function focusNewNote() {
  console.log('focusNewNote');
  const el = document.getElementById('composer');
  el.focus();
}

// TODO: should do it the react way
export function clearNewNote() {
  // TODO: this doesn't work
  console.log('clearNewNote');
  // TODO: write me
  //const el = document.getElementById('Composer');
  //el.nodeValue = '';
  //$('#composer').val(null);
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
