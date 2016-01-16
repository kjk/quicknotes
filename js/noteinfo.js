import * as api from './api.js';
import { assert } from './utils.js';
import filesize from 'filesize';

const noteHashIDIdx = 0;
const noteTitleIdx = 1;
const noteSizeIdx = 2;
const noteFlagsIdx = 3;
const noteCreatedAtIdx = 4;
//noteUpdatedAtIdx
const noteTagsIdx = 5;
const noteSnippetIdx = 6;
const noteFormatIdx = 7;
const noteCurrentVersionIdx = 8;
const noteContentIdx = 9;

const flagStarredBit = 0;
const flagDeletedBit = 1;
const flagPublicBit = 2;
const flagPartialBit = 3;

const formatText = 1;
const formatMarkdown = 2;

const formatNames = [
  'text',
  'markdown'
];

// note properties that can be compared for equality with ==
const simpleProps = [noteHashIDIdx, noteTitleIdx, noteSizeIdx, noteFlagsIdx, noteCreatedAtIdx, noteFormatIdx, noteCurrentVersionIdx, noteContentIdx];

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

export function IDStr(note) {
  return note[noteHashIDIdx];
}

export function Title(note) {
  return note[noteTitleIdx];
}

export function Size(note) {
  return note[noteSizeIdx];
}

export function CreatedAt(note) {
  return note[noteCreatedAtIdx];
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
  return note[noteCurrentVersionIdx];
}

export function Content(note, cb) {
  return note[noteContentIdx] || '';
}

// if has content, returns it
// otherwise returns null, starts async fetch and
// will call cb when finished fetching content
// TODO: always call callback
export function FetchContent(note, cb) {
  const noteID = IDStr(note);
  const res = note[noteContentIdx];
  if (res) {
    console.log('getContent: already has it for note', noteID);
    return res;
  }
  console.log('getContent: starting to fetch content for note', noteID);
  api.getNoteCompact(noteID, json => {
    console.log('getContent: json=', json);
    const content = json[noteContentIdx];
    //console.log('getContent: content=', content);
    SetContent(note, content);
    cb(note);
  });
  return null;
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

export function SetTitle(note, title) {
  note[noteTitleIdx] = title;
}

export function SetTags(note, tags) {
  note[noteTagsIdx] = tags;
}

export function SetFormat(note, format) {
  note[noteFormatIdx] = format;
}

export function SetContent(note, content) {
  note[noteContentIdx] = content;
}

/* locally manage expanded/collapsed state of notes */

let expandedNotes = {};

export function IsExpanded(note) {
  const id = IDStr(note);
  return expandedNotes.hasOwnProperty(id);
}

export function IsCollapsed(note) {
  return !IsExpanded(note);
}

export function Expand(note) {
  const id = IDStr(note);
  expandedNotes[id] = true;
}

export function Collapse(note) {
  const id = IDStr(note);
  delete expandedNotes[id];
}

