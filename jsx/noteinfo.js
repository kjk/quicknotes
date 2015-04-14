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

function isBitSet(n, nBit) {
  return (n & (1 << nBit)) != 0;
}

function setBit(n, nBit) {
  return n | (1 << nBit);
}

function clearBit(n, nBit) {
  return n & (1 << nBit);
}

function setFlag(note, nBit) {
  var flags = note[noteFlagsIdx];
  note[noteFlagsIdx] = setBit(flags, nBit);
}

function clearFlag(note, nBit) {
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

function getHumanSize(note) {
  // TODO: write me
  return "" + getSize(note) + " bytes";
}

var flagStarred = 0;
var flagDeleted = 1;
var flagPublic = 2;
var flagPartial = 3;

function isFlagSet(note, nBit) {
  return isBitSet(note[noteFlagsIdx], nBit);
}

function getIsStarred(note) {
  return isFlagSet(note, flagStarred);
}

function getIsDeleted(note) {
  return isFlagSet(note, flagDeleted);
}

function getIsPublic(note) {
  return isFlagSet(note, flagPublic);
}

function getIsPartial(note) {
  return isFlagSet(note, flagPartial);
}

function setFlag(note, nBit) {
  note[noteFlagsIdx] = setBit(note[noteFlagsIdx], nBit)
}

function setIsStarred(note) {
  setFlag(note, flagStarred);
}

function setIsDeleted(note) {
  setFlag(note, flagDeleted);
}

function setIsPublic(note) {
  setFlag(note, flagPublic);
}

function setFlagState(note, f, nBit) {
  if (f) {
    setBit(note, nBit);
  } else {
    clearBit(note, nBit);
  }
}

function setPublicState(note, isPublic) {
  setFlagState(note, isPublic, flagPublic);
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
exports.SetPublicState = setPublicState;
exports.SetTitle = setTitle;
exports.SetTags = setTags;
exports.SetFormat = setFormat;
