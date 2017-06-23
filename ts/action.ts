/* reusable part */

// Loosely inspired by flux ideas.
// One part of the code can trigger an action by calling a function in this
// module. Other parts of the code can provide callbacks to be called when
// action is triggered.

type CallbackFunctionVariadic = (...args: any[]) => void;

type CallbackInfo = [CallbackFunctionVariadic, number, any];

interface RegisteredActions {
  [idx: string]: CallbackInfo[];
}

interface Store {
  [idx: string]: any;
}

const store: Store = {};

// value at a given index is [[cbFunc, cbId], ...]
const registeredActions: RegisteredActions = {};

// current global callback id to hand out in on()
// we don't bother recycling them after off()
let currCid = 0;

function broadcast(actionCmd: string, ...rest: any[]) {
  const callbacks: CallbackInfo[] = registeredActions[actionCmd];
  if (!callbacks || callbacks.length === 0) {
    console.log('action.broadcast: no callback for action', actionCmd);
    return;
  }

  for (let cbInfo of callbacks) {
    const cb = cbInfo[0];
    // console.log('action.broadcast: calling callback for action', actionCmd, 'args:', args);
    if (rest.length > 0) {
      cb.apply(null, rest);
    } else {
      cb();
    }
  }
}

// subscribe to be notified about an action.
// returns an id that can be used to unsubscribe with off()
export function on(actionCmd: string, cb: CallbackFunctionVariadic, owner: any): number {
  currCid++;
  const callbacks: CallbackInfo[] = registeredActions[actionCmd];
  const cbInfo: CallbackInfo = [cb, currCid, owner];
  if (!callbacks) {
    registeredActions[actionCmd] = [cbInfo];
  } else {
    callbacks.push(cbInfo);
  }
  return currCid;
}

export function off(actionCmd: string, cbIdOrOwner: any): number {
  const callbacks: CallbackInfo[] = registeredActions[actionCmd] || [];
  const n = callbacks.length;
  for (let i = 0; i < n; i++) {
    const cbInfo: CallbackInfo = callbacks[i];
    if (cbInfo[1] === cbIdOrOwner || cbInfo[2] === cbIdOrOwner) {
      callbacks.splice(i, 1);
      return 1 + off(actionCmd, cbIdOrOwner);
    }
  }
  return 0;
  //console.log("action.off: didn't find callback id", cbId, "for action", actionCmd);
}

export function offAllForOwner(owner: any) {
  for (let actionCmd in registeredActions) {
    off(actionCmd, owner);
  }
}

/* actions specific to an app */

import { Note } from './Note';

// keys for registeredActions
const tagSelectedCmd = 'tagSelectedCmd';
const showHideImportSimpleNoteCmd = 'showHideImportSimpleNoteCmd';
const showHideSettingsCmd = 'showHideSettingsCmd';
const editNewNoteCmd = 'editNewNoteCmd';
const editNoteCmd = 'editNoteCmd';
const startSearchDelayedCmd = 'startSearchDelayedCmd';
const clearSearchTermCmd = 'clearSearchTermCmd';
const showTemporaryMessageCmd = 'showTemporaryMessageCmd';
const showConnectionStatusCmd = 'showConnectionStatusCmd';
const updateNotesCmd = 'updateNotesCmd';

/* --------------------- */
export function tagSelected(tag: string, op: string) {
  broadcast(tagSelectedCmd, tag, op);
}

export function onTagSelected(cb: any, owner: any): number {
  return on(tagSelectedCmd, cb, owner);
}

/* --------------------- */
export function onShowHideImportSimpleNote(cb: any, owner: any) {
  return on(showHideImportSimpleNoteCmd, cb, owner);
}

export function showHideImportSimpleNote(shouldShow: boolean) {
  broadcast(showHideImportSimpleNoteCmd, shouldShow);
}

/* --------------------- */
export function showSettings() {
  broadcast(showHideSettingsCmd, true);
}

export function hideSettings() {
  broadcast(showHideSettingsCmd, false);
}

export function onShowHideSettings(cb: any, owner: any) {
  return on(showHideSettingsCmd, cb, owner);
}

/* --------------------- */
export function editNewNote() {
  broadcast(editNewNoteCmd);
}

export function onEditNewNote(cb: any, owner: any) {
  return on(editNewNoteCmd, cb, owner);
}

/* --------------------- */
export function editNote(note: Note) {
  broadcast(editNoteCmd, note);
}

export function onEditNote(cb: any, owner: any) {
  return on(editNoteCmd, cb, owner);
}

/* --------------------- */
export interface StartSearchDelayedCb {
  (userIDHash: string, searchTerm: string): void;
}

export function startSearchDelayed(userIDHash: string, term: string) {
  broadcast(startSearchDelayedCmd, userIDHash, term);
}

export function onStartSearchDelayed(cb: StartSearchDelayedCb, owner: any) {
  return on(startSearchDelayedCmd, cb, owner);
}

/* --------------------- */
export interface ClearSearchTermCb {
  (): void;
}

export function clearSearchTerm() {
  broadcast(clearSearchTermCmd);
}

export function onClearSearchTerm(cb: ClearSearchTermCb, owner: any) {
  return on(clearSearchTermCmd, cb, owner);
}

/* --------------------- */

export interface ShowTemporaryMessageCb {
  (msg: string, delay?: number): void;
}

export function showTemporaryMessage(msg: string, delayMs?: number) {
  broadcast(showTemporaryMessageCmd, msg, delayMs);
}

export function onShowTemporaryMessage(cb: ShowTemporaryMessageCb, owner: any) {
  return on(showTemporaryMessageCmd, cb, owner);
}

/* --------------------- */

interface ShowConnectionStatusCb {
  (msg?: string): void;
}

export function getConnectionStatus(): string {
  return store[showConnectionStatusCmd];
}

export function showConnectionStatus(msgHTML?: string) {
  store[showConnectionStatusCmd] = msgHTML;
  broadcast(showConnectionStatusCmd, msgHTML);
}

export function onShowConnectionStatus(cb: ShowConnectionStatusCb, owner: any) {
  return on(showConnectionStatusCmd, cb, owner);
}

/* --------------------- */
interface UpdateNotesCb {
  (notes: Note[]): void;
}

export function updateNotes(notes: Note[]) {
  broadcast(updateNotesCmd, notes);
}

export function onUpdateNotes(cb: UpdateNotesCb, owner: any) {
  return on(updateNotesCmd, cb, owner);
}
