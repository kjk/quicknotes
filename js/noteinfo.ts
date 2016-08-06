/// <reference path="../typings/index.d.ts" />

import * as api from './api';
import { assert, isUndefined } from './utils';
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

type INote = [
  string, // noteIDVerIdx
  string, // noteTitleIdx
  number, // noteSizeIdx
  number, // noteFlagsIdx
  number, // noteCreatedAtIdx
  number, // noteUpdatedAtIdx
  string, // noteFormatIdx
  string[], // noteTagsIdx
  string, // noteSnippetIdx
  string // noteContentIdx
];

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
const simpleProps = [noteIDVerIdx, noteTitleIdx, noteSizeIdx, noteFlagsIdx, noteCreatedAtIdx, noteFormatIdx, noteSnippetIdx, noteContentIdx];

interface StringSet {
  [idx: string]: number
}

function arrEmpty(a?: any[]) {
  return !a || (a.length === 0);
}

function strArrEq(a1?: string[], a2?: string[]) {
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

  let d: StringSet = {};
  let i: number, s: string;
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

function notesEq(n1: any, n2: any) {
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

function isBitSet(n: number, nBit: number): boolean {
  return (n & (1 << nBit)) !== 0;
}

function setBit(n: number, nBit: number): number {
  return n | (1 << nBit);
}

function clearBit(n: number, nBit: number) {
  return n & ~(1 << nBit);
}

function setFlagBit(note: any, nBit: number) {
  var flags = note[noteFlagsIdx];
  note[noteFlagsIdx] = setBit(flags, nBit);
}

function clearFlagBit(note: any, nBit: number) {
  var flags = note[noteFlagsIdx];
  note[noteFlagsIdx] = clearBit(flags, nBit);
}

export function IDVer(note: any): string {
  return note[noteIDVerIdx];
}

export function HashID(note: any): string {
  const s = note[noteIDVerIdx];
  return s.split('-')[0];
}

export function Version(note: any): string {
  const s = note[noteIDVerIdx];
  return s.split('-')[1];
}

export function Title(note: any): string {
  return note[noteTitleIdx];
}

export function Size(note: any): number {
  return note[noteSizeIdx];
}

export function CreatedAt(note: any): Date {
  const epochMs = note[noteCreatedAtIdx];
  return new Date(epochMs);
}

export function UpdatedAt(note: any): Date {
  const epochMs = note[noteUpdatedAtIdx];
  return new Date(epochMs);
}

export function Tags(note: any): string[] {
  return note[noteTagsIdx] || [];
}

export function Snippet(note: any): string {
  return note[noteSnippetIdx];
}

export function Format(note: any): string {
  return note[noteFormatIdx];
}

export function CurrentVersion(note: any): string {
  const s = note[noteIDVerIdx];
  return s.split('-')[1];
}

export function GetContentDirect(note: any): string {
  return note[noteContentIdx];
}

type VerContent = [string, string];

interface ContentCache {
  [idx: string]: VerContent
}

// the key is id, the value is [idVer, content]
// TODO: cache in local storage
let contentCache: ContentCache = {};

function getCachedVersion(note: any): string {
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

function setCachedVersion(note: any): string {
  const noteID = HashID(note);
  const idVer = IDVer(note);
  const content = note[noteContentIdx];
  // this over-writes other versions of this note
  contentCache[noteID] = [idVer, content];
  return content;
}

// returns content if already has it or null
export function Content(note: any): string {
  if (!IsPartial(note) && !IsTruncated(note)) {
    return Snippet(note);
  }
  return getCachedVersion(note);
}

// gets the latest version of content of a given note.
// Call cb(note, content) on success
// Note: it gets the latest version, not the version on noteOrig
export function FetchLatestContent(noteOrig: any, cb: any) {
  const noteID = HashID(noteOrig);
  const content = Content(noteOrig);
  if (content !== null) {
    // console.log('FetchLatestContent: already has it for note', IDVer(noteOrig));
    cb(noteOrig, content);
    return;
  }
  // console.log('FetchLatestContent: starting to fetch content for note', noteID);
  api.getNote(noteID, (note: any) => {
    // console.log('FetchLatestContent: json=', note);
    // version might be newer than in noteOrig
    let content = setCachedVersion(note);
    //console.log('FetchLatestContent: content=', content);
    cb(note, content);
  });
}

export function HumanSize(note: any): string {
  return filesize(Size(note));
}

function isFlagSet(note: any, nBit: number): boolean {
  return isBitSet(note[noteFlagsIdx], nBit);
}

export function IsStarred(note: any): boolean {
  return isFlagSet(note, flagStarredBit);
}

export function IsDeleted(note: any): boolean {
  return isFlagSet(note, flagDeletedBit);
}

export function IsPublic(note: any): boolean {
  return isFlagSet(note, flagPublicBit);
}

export function IsPrivate(note: any): boolean {
  return !IsPublic(note);
}

// partial is if full content is != snippet
export function IsPartial(note: any): boolean {
  return isFlagSet(note, flagPartialBit);
}

export function IsTruncated(note: any): boolean {
  return isFlagSet(note, flagTruncatedBit);
}

export function NeedsExpansion(note: any): boolean {
  return IsPartial(note) || IsTruncated(note);
}

export function SetTitle(note: any, title: string) {
  note[noteTitleIdx] = title;
}

export function SetTags(note: any, tags: any) {
  note[noteTagsIdx] = tags;
}

export function SetFormat(note: any, format: string) {
  note[noteFormatIdx] = format;
}

/* locally manage expanded/collapsed state of notes */

interface ExpandedNotes {
  [idx: string]: boolean
}

let expandedNotes: ExpandedNotes = {};

export function IsExpanded(note: any): boolean {
  const id = HashID(note);
  return expandedNotes.hasOwnProperty(id);
}

export function IsCollapsed(note: any): boolean {
  return !IsExpanded(note);
}

export function Expand(note: any) {
  const id = HashID(note);
  expandedNotes[id] = true;
}

export function Collapse(note: any) {
  const id = HashID(note);
  delete expandedNotes[id];
}

function cmpDescByField(n1: any, n2: any, idx: any): number {
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

function cmpAscByField(n1: any, n2: any, idx: any): number {
  return -cmpDescByField(n1, n2, idx);
}

export function sortNotesByUpdatedAt(notes: any): any {
  return notes.sort(function(n1: any, n2: any) {
    return cmpDescByField(n1, n2, noteUpdatedAtIdx);
  });
}

export function sortNotesByCreatedAt(notes: any): any {
  return notes.sort(function(n1: any, n2: any) {
    return cmpDescByField(n1, n2, noteCreatedAtIdx);
  });
}

export function sortNotesBySize(notes: any): any {
  return notes.sort(function(n1: any, n2: any) {
    return cmpDescByField(n1, n2, noteSizeIdx);
  });
}
