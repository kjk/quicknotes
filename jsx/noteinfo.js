/* jshint -W09,-W1177 */
'use strict';

var noteHashIDIdx = 0;
var noteTitleIdx = 1;
var noteSizeIdx = 2;
var noteFlagsIdx = 3;
var noteCreatedAtIdx = 4;
//noteUpdatedAtIdx
var noteTagsIdx = 5;
var noteSnippetIdx = 6;
var noteFormatIdx = 7;
var noteCurrentVersionIDIdx = 8;
var noteContentIdx = 9;

var flagStarredBit = 0;
var flagDeletedBit = 1;
var flagPublicBit = 2;
var flagPartialBit = 3;

// note properties that can be compared for equality with ==
var simpleProps = [noteHashIDIdx, noteTitleIdx, noteSizeIdx, noteFlagsIdx, noteCreatedAtIdx, noteFormatIdx, noteCurrentVersionIDIdx, noteContentIdx];

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

  // TODO: don't sort in-place, maybe use a dict way of comparing equality
  var a1 = a1.sort();
  var a2 = a2.sort();
  var n = a1.length;
  if (n != a2.length) {
    return false;
  }
  for (var i=0; i < n; i++) {
    if (a1[i] != a2[i]) {
      return false;
    }
  }
  return true;
}

function notesEq(n1, n2) {
  // Note: maybe should compare content after trim() ?
  for (var i = 0; i< simpleProps.length; i++) {
    var prop = simpleProps[i];
    if (n1[prop] != n2[prop]) {
      return false;
    }
  }
  return strArrEq(n1[noteTagsIdx], n2[noteTagsIdx]);
}

function isBitSet(n, nBit) {
  return (n & (1 << nBit)) != 0;
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

function getContent(note) {
  return note[noteContentIdx];
}

function getHumanSize(note) {
  // TODO: write me
  return "" + getSize(note) + " bytes";
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

exports.IDStr = getIDStr;
exports.Title = getTitle;
exports.Size = getSize;
exports.CreatedAt = getCreatedAt;
exports.Tags = getTags;
exports.Snippet = getSnippet;
exports.Format = getFormat;
exports.CurrentVersionID = getCurrentVersionID;
exports.IsStarred = getIsStarred;
exports.IsDeleted = getIsDeleted;
exports.IsPublic = getIsPublic;
exports.IsPartial = getIsPartial;
exports.HumanSize = getHumanSize;
exports.Content = getContent;
exports.SetPublicState = setPublicState;
exports.SetTitle = setTitle;
exports.SetTags = setTags;
exports.SetFormat = setFormat;
exports.SetContent = setContent;
exports.notesEq = notesEq;
exports.toNewNote = toNewNote;
