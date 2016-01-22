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
  //console.log('focusSearch');
  const el = document.getElementById('search-input');
  el.focus();
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

/*
Returns a function, that, as long as it continues to be invoked,
will not be triggered. The function will be called after it stops
being called for N milliseconds. If `immediate` is passed, trigger
the function on the leading edge, instead of the trailing.
*/
export function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this,
      args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// TODO: make conditional on NODE_ENV['production'] so that it gets
// optimized out in production build
// TODO: also show in an alert?
export function assert(cond) {
  if (!cond) {
    throw 'assert() failed';
  }
}

export function strArrRemoveDups(a) {
  if (a.length == 0) {
    return a;
  }
  let d = {};
  for (let v of a) {
    d[v] = 1;
  }
  return Object.keys(d);
}

// Use the browser's built-in functionality to quickly and
// safely escape the string
export function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
;

window.runOnLoad = runOnLoad;
console.log('iniialized window.runOnLoad');
