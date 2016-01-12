import * as api from './api.js';

const noteHashIDIdx = 0;
const noteTitleIdx = 1;
const noteSizeIdx = 2;
const noteFlagsIdx = 3;
const noteCreatedAtIdx = 4;
//noteUpdatedAtIdx
const noteTagsIdx = 5;
const noteSnippetIdx = 6;
const noteFormatIdx = 7;
const noteCurrentVersionIDIdx = 8;
const noteContentIdx = 9;

const flagStarredBit = 0;
const flagDeletedBit = 1;
const flagPublicBit = 2;
const flagPartialBit = 3;

// note properties that can be compared for equality with ==
const simpleProps = [noteHashIDIdx, noteTitleIdx, noteSizeIdx, noteFlagsIdx, noteCreatedAtIdx, noteFormatIdx, noteCurrentVersionIDIdx, noteContentIdx];

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
  for (let prop of simpleProps) {
    if (n1[prop] != n2[prop]) {
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

function getIDStr(note) {
  return note[noteHashIDIdx];
}

function getTitle(note) {
  return note[noteTitleIdx];
}

function getSize(note) {
  return note[noteSizeIdx];
}

function getCreatedAt(note) {
  return note[noteCreatedAtIdx];
}

function getTags(note) {
  return note[noteTagsIdx];
}

function getSnippet(note) {
  return note[noteSnippetIdx];
}

function getFormat(note) {
  return note[noteFormatIdx];
}

function getCurrentVersionID(note) {
  return note[noteCurrentVersionIDIdx];
}

function getContent(note, cb) {
  return note[noteContentIdx] || '';
}

function fetchContentIfNeeded(note, cb) {
  const noteID = getIDStr(note);
  const res = note[noteContentIdx];
  if (res) {
    console.log('getContent: already has it for note', noteID);
    cb(note);
    return;
  }
  console.log('getContent: starting to fetch content for note', noteID);
  api.getNoteCompact(noteID, json => {
    console.log('getContent: json=', json);
    const content = json[noteContentIdx];
    console.log('getContent: content=', content);
    setContent(note, content);
    cb(note);
  });
}

function getHumanSize(note) {
  // TODO: write me
  return '' + getSize(note) + ' bytes';
}

function isFlagSet(note, nBit) {
  return isBitSet(note[noteFlagsIdx], nBit);
}

function getIsStarred(note) {
  return isFlagSet(note, flagStarredBit);
}

function getIsDeleted(note) {
  return isFlagSet(note, flagDeletedBit);
}

function getIsPublic(note) {
  return isFlagSet(note, flagPublicBit);
}

// partial is if full content is != snippet
function getIsPartial(note) {
  return isFlagSet(note, flagPartialBit);
}

function setIsStarred(note) {
  setFlagBit(note, flagStarredBit);
}

function setIsDeleted(note) {
  setFlagBit(note, flagDeletedBit);
}

function setIsPublic(note) {
  setFlagBit(note, flagPublicBit);
}

function setFlagState(note, f, nBit) {
  if (f) {
    setFlagBit(note, nBit);
  } else {
    clearFlagBit(note, nBit);
  }
}

function setPublicState(note, isPublic) {
  setFlagState(note, isPublic, flagPublicBit);
}

function setTitle(note, title) {
  note[noteTitleIdx] = title;
}

function setTags(note, tags) {
  note[noteTagsIdx] = tags;
}

function setFormat(note, format) {
  note[noteFormatIdx] = format;
}

function setContent(note, content) {
  note[noteContentIdx] = content;
}

/* convert compact note to
type NewNoteFromBrowser struct {
	IDStr    string
	Title    string
	Format   int
	Content  string
	Tags     []string
	IsPublic bool
}
*/
function toNewNote(note) {
  var n = {};
  n.IDStr = getIDStr(note);
  n.Title = getTitle(note);
  n.Format = getFormat(note);
  n.Content = getContent(note);
  n.Tags = getTags(note);
  n.IsPublic = getIsPublic(note);
  return n;
}

/* locally manage expanded/collapsed state of notes */

let expandedNotes = {};

function isExpanded(note) {
  const id = getIDStr(note);
  return expandedNotes.hasOwnProperty(id);
}

function isCollapsed(note) {
  return !isExpanded(note);
}

function expand(note) {
  const id = getIDStr(note);
  expandedNotes[id] = true;
}

function collapse(note) {
  const id = getIDStr(note);
  delete expandedNotes[id];
}

export { getIDStr as IDStr, getTitle as Title, getSize as Size, getCreatedAt as CreatedAt, getTags as Tags, getSnippet as Snippet, getFormat as Format, getCurrentVersionID as CurrentVersionID, getIsStarred as IsStarred, getIsDeleted as IsDeleted, getIsPublic as IsPublic, getIsPartial as IsPartial, getHumanSize as HumanSize, getContent as Content, fetchContentIfNeeded as FetchContent, setPublicState as SetPublicState, setTitle as SetTitle, setTags as SetTags, setFormat as SetFormat, setContent as SetContent, isExpanded as IsExpanded, isCollapsed as IsCollapsed, expand as Expand, collapse as Collapse, notesEq as notesEq, toNewNote as toNewNote };
