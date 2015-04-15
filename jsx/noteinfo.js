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

function isBitSet(n, nBit) {
  return (n & (1 << nBit)) != 0;
}

function getIsStarred(note) {
  return isBitSet(note[noteFlagsIdx], 0);
}

function getIsDeleted(note) {
  return isBitSet(note[noteFlagsIdx], 1);
}

function getIsPublic(note) {
  return isBitSet(note[noteFlagsIdx], 2);
}

function getIsPartial(note) {
  return isBitSet(note[noteFlagsIdx], 3);
}

exports.getIDStr = getIDStr;
exports.getTitle = getTitle;
exports.getSize = getSize;
exports.getCreatedAt = getCreatedAt;
exports.getTags = getTags;
exports.getSnippet = getSnippet;
exports.getFormat = getFormat;
exports.getCurrentVersionID = getCurrentVersionID;
exports.getIsStarred = getIsStarred;
exports.getIsDeleted = getIsDeleted;
exports.getIsPublic = getIsPublic;
exports.getIsPartial = getIsPartial;
