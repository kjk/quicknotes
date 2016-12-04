import * as api from './api';
import { assert, isUndefined, Dict } from './utils';
import filesize from 'filesize';

// order of properties in a note represented as an array,
// as sent from the server
// must match order in handlers.go
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

/*
Keep expanded/collapsed state of notes as an array. We could try
to store it as a bit on note object but I worry about keeping
things synced when they are copied, updated from the server.
 */

// could be a map of string -> bool but for small number of items
// array is more efficient
let expandedNotes: string[] = [];

// a note
export class Note extends Array {

  constructor() {
    super();
  }

  IDVer(): string {
    return this[noteIDVerIdx] as string;
  }

  HashID(): string {
    const s = this[noteIDVerIdx] as string;
    return s.split('-')[0];
  }

  Version(): string {
    const s = this[noteIDVerIdx] as string;
    return s.split('-')[1];
  }

  Title(): string {
    return this[noteTitleIdx] as string;
  }

  Size(): number {
    return this[noteSizeIdx] as number;
  }

  CreatedAt(): Date {
    const epochMs = this[noteCreatedAtIdx] as number;
    return new Date(epochMs);
  }

  UpdatedAt(): Date {
    const epochMs = this[noteUpdatedAtIdx] as number;
    return new Date(epochMs);
  }

  Tags(): string[] {
    return this[noteTagsIdx] as string[] || [];
  }

  Snippet(): string {
    return this[noteSnippetIdx] as string;
  }

  Format(): string {
    return this[noteFormatIdx] as string;
  }

  CurrentVersion(): string {
    const s = this[noteIDVerIdx] as string;
    return s.split('-')[1];
  }

  GetContentDirect(): string {
    return this[noteContentIdx] as string;
  }

  SetTitle(title: string) {
    this[noteTitleIdx] = title;
  }

  SetTags(tags: string[]): void {
    this[noteTagsIdx] = tags;
  }

  SetFormat(format: string): void {
    this[noteFormatIdx] = format;
  }

  HumanSize(): string {
    return filesize(this.Size());
  }

  IsStarred(): boolean {
    return this.isFlagSet(flagStarredBit);
  }

  IsDeleted(): boolean {
    return this.isFlagSet(flagDeletedBit);
  }

  IsPublic(): boolean {
    return this.isFlagSet(flagPublicBit);
  }

  IsPrivate(): boolean {
    return !this.IsPublic();
  }

  // partial is if full content is != snippet
  IsPartial(): boolean {
    return this.isFlagSet(flagPartialBit);
  }

  IsTruncated(): boolean {
    return this.isFlagSet(flagTruncatedBit);
  }

  NeedsExpansion(): boolean {
    return this.IsPartial() || this.IsTruncated();
  }

  IsExpanded(): boolean {
    const id = this.HashID();
    return expandedNotes.indexOf(id) != -1;
  }

  IsCollapsed(): boolean {
    return !this.IsExpanded();
  }

  Expand(): void {
    const id = this.HashID();
    if (!this.IsExpanded()) {
      expandedNotes.push(id);
    }
  }

  Collapse(): void {
    const id = this.HashID();
    const idx = expandedNotes.indexOf(id);
    if (idx != -1) {
      expandedNotes.splice(idx, 1);
    }
  }

  getFlags(): number {
    return this[noteFlagsIdx] as number;
  }

  setFlags(n: number): void {
    this[noteFlagsIdx] = n;
  }

  isFlagSet(nBit: number): boolean {
    return isBitSet(this.getFlags(), nBit);
  }
}

export function toNote(note: any): Note {
  Object.setPrototypeOf(note, Note.prototype);
  return note as Note;
}

export function toNotes(a: any): Note[] {
  if (!a) {
    return [];
  }
  for (var i = 0; i < a.length; i++) {
    toNote(a[i]);
  }
  return a as Note[];
}

// must match handlers.go
const flagStarredBit = 0;
const flagDeletedBit = 1;
const flagPublicBit = 2;
const flagPartialBit = 3;
const flagTruncatedBit = 4;

// must match db.go
export const FormatText = 'txt';
export const FormatMarkdown = 'md';
const FormatHTML = 'html';
const FormatCodePrefix = 'code:';

// note properties that can be compared for equality with ==
const simpleProps = [noteIDVerIdx, noteTitleIdx, noteSizeIdx, noteFlagsIdx, noteCreatedAtIdx, noteFormatIdx, noteSnippetIdx, noteContentIdx];

export type TagToCount = Dict<number>;

function arrEmpty(a?: any[]): boolean {
  return !a || (a.length === 0);
}

function strArrEq(a1?: string[], a2?: string[]): boolean {
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

  let d: Dict<number> = {};
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

/*
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
*/

function isBitSet(n: number, nBit: number): boolean {
  return (n & (1 << nBit)) !== 0;
}

function setBit(n: number, nBit: number): number {
  return n | (1 << nBit);
}

function clearBit(n: number, nBit: number) {
  return n & ~(1 << nBit);
}

// Note: needed to add casting because type of tuple element indexed
// via const variable is incorrect.
// see: https://github.com/Microsoft/TypeScript/issues/10186
function setFlagBit(note: Note, nBit: number) {
  const flags = note.getFlags();
  note.setFlags(setBit(flags, nBit));
}

function clearFlagBit(note: Note, nBit: number) {
  const flags = note.getFlags();
  note.setFlags(clearBit(flags, nBit));
}

type VerContent = [string, string];

interface ContentCache {
  [idx: string]: VerContent;
}

// the key is id, the value is [idVer, content]
// TODO: cache in local storage
let contentCache: ContentCache = {};

function getCachedVersion(note: Note): string {
  const id = note.HashID();
  const verContent = contentCache[id];
  if (isUndefined(verContent)) {
    return null;
  }
  const [idVer, content] = verContent;
  if (idVer === note.IDVer()) {
    return content;
  }
  return null;
}

function setCachedVersion(note: Note): string {
  const noteID = note.HashID();
  const idVer = note.IDVer();
  const content = note.GetContentDirect() as string;
  // this over-writes other versions of this note
  contentCache[noteID] = [idVer, content];
  return content;
}

// returns content if already has it or null
export function Content(note: Note): string {
  if (!note.IsPartial() && !note.IsTruncated()) {
    return note.Snippet();
  }
  return getCachedVersion(note);
}

interface FetchLatestContentCallback {
  (note: Note, body: string): void;
}

// gets the latest version of content of a given note.
// Call cb(note, content) on success
// Note: it gets the latest version, not the version on noteOrig
export function FetchLatestContent(noteOrig: Note, cb: FetchLatestContentCallback) {
  const noteID = noteOrig.HashID();
  const content = Content(noteOrig);
  if (content !== null) {
    // console.log('FetchLatestContent: already has it for note', IDVer(noteOrig));
    cb(noteOrig, content);
    return;
  }
  // console.log('FetchLatestContent: starting to fetch content for note', noteID);
  api.getNote(noteID, (err: Error, note: Note) => {
    if (err) {
      return;
    }
    // console.log('FetchLatestContent: json=', note);
    // version might be newer than in noteOrig
    const content = setCachedVersion(note);
    //console.log('FetchLatestContent: content=', content);
    cb(note, content);
  });
}

function cmpDescByField(note1: Note, note2: Note, idx: number): number {
  const n1 = note1 as any;
  const n2 = note2 as any;

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

function cmpAscByField(n1: Note, n2: Note, idx: any): number {
  return -cmpDescByField(n1, n2, idx);
}

export function sortNotesByUpdatedAt(notes: Note[]): Note[] {
  return notes.sort(function(n1: any, n2: any) {
    return cmpDescByField(n1, n2, noteUpdatedAtIdx);
  });
}

export function sortNotesByCreatedAt(notes: Note[]): Note[] {
  return notes.sort(function(n1: any, n2: any) {
    return cmpDescByField(n1, n2, noteCreatedAtIdx);
  });
}

export function sortNotesBySize(notes: Note[]): Note[] {
  return notes.sort(function(n1: any, n2: any) {
    return cmpDescByField(n1, n2, noteSizeIdx);
  });
}
