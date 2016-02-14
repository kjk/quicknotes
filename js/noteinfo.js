'use strict';

import * as api from './api.js';
import { assert, isUndefined } from './utils.js';
import filesize from 'filesize';

// must match handlers.go
const noteIDVerIdx = 0;
const noteTitleIdx = 1;
const noteSizeIdx = 2;
const noteFlagsIdx = 3;
const noteCreatedAtIdx = 4;
const noteUpdatedAtIdx = 5;
const noteFormatIdx = 6;
const noteTagsIdx = 7;
const noteSnippetIdx = 8;
const noteContentIdx = 9;
// those are only for notes returned by recent notes
const noteUserIdx = 10; // user that created the note TODO: not sure if will keep

// must match handlers.go
const flagStarredBit = 0;
const flagDeletedBit = 1;
const flagPublicBit = 2;
const flagPartialBit = 3;
const flagTruncatedBit = 4;

// must match db.go
export const formatText = 'txt';
export const formatMarkdown = 'md';
const formatHTML = 'html';
const formatCodePrefix = 'code:';

// note properties that can be compared for equality with ==
const simpleProps = [noteIDVerIdx, noteTitleIdx, noteSizeIdx, noteFlagsIdx, noteCreatedAtIdx, noteFormatIdx, noteSnippetIdx, noteContentIdx, noteUserIdx];

function arrEmpty(a) {
  return !a || (a.length === 0);
}

function strArrEq(a1, a2) {
  if (arrEmpty(a1) && arrEmpty(a2)) {
    // both empty
    return true;
  }
  if (arrEmpty(a1) || arrEmpty(a2)) {
    // only one empty
    return false;
  }

  // Note: can't short-circuit by checking the lengths because
  // that doesn't handle duplicate keys

  let d = {};
  let i, s;
  for (i = 0; i < a1.length; i++) {
    s = a1[i];
    d[s] = 1;
  }
  for (i = 0; i < a2.length; i++) {
    s = a2[i];
    if (!d.hasOwnProperty(s)) {
      return false;
    }
    d[s] = 2;
  }
  for (var k in d) {
    if (d.hasOwnProperty(k)) {
      if (d[k] != 2) {
        return false;
      }
    }
  }
  return true;
}

function notesEq(n1, n2) {
  // Note: maybe should compare content after trim() ?
  for (let propIdx of simpleProps) {
    const v1 = n1[propIdx];
    const v2 = n2[propIdx];

    assert(typeof v1 === typeof v2);
    if (v1 !== v2) {
      return false;
    }
  }
  return strArrEq(n1[noteTagsIdx], n2[noteTagsIdx]);
}

function isBitSet(n, nBit) {
  return (n & (1 << nBit)) !== 0;
}

function setBit(n, nBit) {
  return n | (1 << nBit);
}

function clearBit(n, nBit) {
  return n & ~(1 << nBit);
}

function setFlagBit(note, nBit) {
  var flags = note[noteFlagsIdx];
  note[noteFlagsIdx] = setBit(flags, nBit);
}

function clearFlagBit(note, nBit) {
  var flags = note[noteFlagsIdx];
  note[noteFlagsIdx] = clearBit(flags, nBit);
}

export function IDVer(note) {
  return note[noteIDVerIdx];
}

export function HashID(note) {
  const s = note[noteIDVerIdx];
  return s.split('-')[0];
}

export function Version(note) {
  const s = note[noteIDVerIdx];
  return s.split('-')[1];
}

export function Title(note) {
  return note[noteTitleIdx];
}

export function Size(note) {
  return note[noteSizeIdx];
}

export function CreatedAt(note) {
  const epochMs = note[noteCreatedAtIdx];
  return new Date(epochMs);
}

export function UpdatedAt(note) {
  const epochMs = note[noteUpdatedAtIdx];
  return new Date(epochMs);
}

export function Tags(note) {
  return note[noteTagsIdx];
}

export function Snippet(note) {
  return note[noteSnippetIdx];
}

export function Format(note) {
  return note[noteFormatIdx];
}

export function CurrentVersion(note) {
  const s = note[noteIDVerIdx];
  return s.split('-')[1];
}

// the key is id, the value is [idVer, content]
// TODO: cache in local storage
let contentCache = {};

function getCachedVersion(note) {
  const id = HashID(note);
  const verContent = contentCache[id];
  if (isUndefined(verContent)) {
    return null;
  }
  const [idVer, content] = verContent;
  if (idVer === IDVer(note)) {
    return content;
  }
  return null;
}

function setCachedVersion(note) {
  const noteID = HashID(note);
  const idVer = IDVer(note);
  const content = note[noteContentIdx];
  // this over-writes other versions of this note
  contentCache[noteID] = [idVer, content];
  return content;
}

// returns content if already has it or null
export function Content(note) {
  if (!IsPartial(note) && !IsTruncated(note)) {
    return Snippet(note);
  }
  return getCachedVersion(note);
}

/*
// returns the creator of the note
export function User(note) {
  assert(noteUserIdx <= note.length);
  return note[noteUserIdx];
}
*/

// gets the latest version of content of a given note.
// Call cb(note, content) on success
// Note: it gets the latest version, not the version on noteOrig
export function FetchLatestContent(noteOrig, cb) {
  const noteID = HashID(noteOrig);
  const content = Content(noteOrig);
  if (content !== null) {
    // console.log('FetchLatestContent: already has it for note', IDVer(noteOrig));
    cb(noteOrig, content);
    return;
  }
  // console.log('FetchLatestContent: starting to fetch content for note', noteID);
  api.getNote(noteID, note => {
    // console.log('FetchLatestContent: json=', note);
    // version might be newer than in noteOrig
    let content = setCachedVersion(note);
    //console.log('FetchLatestContent: content=', content);
    cb(note, content);
  });
}

export function HumanSize(note) {
  return filesize(Size(note));
}

function isFlagSet(note, nBit) {
  return isBitSet(note[noteFlagsIdx], nBit);
}

export function IsStarred(note) {
  return isFlagSet(note, flagStarredBit);
}

export function IsDeleted(note) {
  return isFlagSet(note, flagDeletedBit);
}

export function IsPublic(note) {
  return isFlagSet(note, flagPublicBit);
}

export function IsPrivate(note) {
  return !IsPublic(note);
}

// partial is if full content is != snippet
export function IsPartial(note) {
  return isFlagSet(note, flagPartialBit);
}

export function IsTruncated(note) {
  return isFlagSet(note, flagTruncatedBit);
}

export function NeedsExpansion(note) {
  return IsPartial(note) || IsTruncated(note);
}

export function SetTitle(note, title) {
  note[noteTitleIdx] = title;
}

export function SetTags(note, tags) {
  note[noteTagsIdx] = tags;
}

export function SetFormat(note, format) {
  note[noteFormatIdx] = format;
}

/* locally manage expanded/collapsed state of notes */

let expandedNotes = {};

export function IsExpanded(note) {
  const id = HashID(note);
  return expandedNotes.hasOwnProperty(id);
}

export function IsCollapsed(note) {
  return !IsExpanded(note);
}

export function Expand(note) {
  const id = HashID(note);
  expandedNotes[id] = true;
}

export function Collapse(note) {
  const id = HashID(note);
  delete expandedNotes[id];
}

function cmpDescByField(n1, n2, idx) {
  const v1 = n1[idx];
  const v2 = n2[idx];
  if (v1 < v2) {
    return 1;
  }
  if (v1 > v2) {
    return -1;
  }
  return 0;
}

function cmpAscByField(n1, n2, idx) {
  return -cmpDescByField(n1, n2, idx);
}

export function sortNotesByUpdatedAt(notes) {
  return notes.sort(function(n1, n2) {
    return cmpDescByField(n1, n2, noteUpdatedAtIdx);
  });
}

export function sortNotesByCreatedAt(notes) {
  return notes.sort(function(n1, n2) {
    return cmpDescByField(n1, n2, noteCreatedAtIdx);
  });
}

export function sortNotesBySize(notes) {
  return notes.sort(function(n1, n2) {
    return cmpDescByField(n1, n2, noteSizeIdx);
  });
}
