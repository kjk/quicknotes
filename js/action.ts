'use strict';

/* reusable part */

// Loosely inspired by flux ideas.
// One part of the code can trigger an action by calling a function in this
// module. Other parts of the code can provide callbacks to be called when
// action is triggered.

// index is one of the above constants.
// value at a given index is [[cbFunc, cbId], ...]
let registeredActions: any = {};

// current global callback id to hand out in on()
// we don't bother recycling them after off()
let currCid = 0;

function broadcast(actionCmd: any, ...rest: any[]) {
  const callbacks: any = registeredActions[actionCmd];
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
export function on(actionCmd: any, cb: any, owner: any) {
  currCid++;
  const callbacks: any = registeredActions[actionCmd];
  const cbInfo = [cb, currCid, owner];
  if (!callbacks) {
    registeredActions[actionCmd] = [cbInfo];
  } else {
    callbacks.push(cbInfo);
  }
  return currCid;
}

export function off(actionCmd: any, cbIdOrOwner: any): number {
  const callbacks = registeredActions[actionCmd] || [];
  const n = callbacks.length;
  for (let i = 0; i < n; i++) {
    const cbInfo = callbacks[i];
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

// keys for registeredActions
const tagSelectedCmd = 'tagSelectedCmd';
const reloadNotesCmd = 'reloadNotesCmd';
const showHideImportSimpleNoteCmd = 'showHideImportSimpleNoteCmd';
const showHideSettingsCmd = 'showHideSettingsCmd';
const editNewNoteCmd = 'editNewNoteCmd';
const editNoteCmd = 'editNoteCmd';
const startSearchDelayedCmd = 'startSearchDelayedCmd';
const clearSearchTermCmd = 'clearSearchTermCmd';
const showTemporaryMessageCmd = 'showTemporaryMessageCmd';

/* --------------------- */
export function tagSelected(tag: any, op: any) {
  broadcast(tagSelectedCmd, tag, op);
}

export function onTagSelected(cb: any, owner: any) {
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
export function reloadNotes(resetScroll: boolean) {
  broadcast(reloadNotesCmd, resetScroll);
}

export function onReloadNotes(cb: any, owner: any) {
  return on(reloadNotesCmd, cb, owner);
}

/* --------------------- */
export function editNewNote() {
  broadcast(editNewNoteCmd);
}

export function onEditNewNote(cb: any, owner: any) {
  return on(editNewNoteCmd, cb, owner);
}

/* --------------------- */
export function editNote(note: any) {
  broadcast(editNoteCmd, note);
}

export function onEditNote(cb: any, owner: any) {
  return on(editNoteCmd, cb, owner);
}

/* --------------------- */
export function startSearchDelayed(userHashID: any, term: string) {
  broadcast(startSearchDelayedCmd, userHashID, term);
}

export function onStartSearchDelayed(cb: any, owner: any) {
  return on(startSearchDelayedCmd, cb, owner);
}

/* --------------------- */
export function clearSearchTerm() {
  broadcast(clearSearchTermCmd);
}

export function onClearSearchTerm(cb: any, owner: any) {
  return on(clearSearchTermCmd, cb, owner);
}

/* --------------------- */
export function showTemporaryMessage(msg: any, delayMs?: any) {
  broadcast(showTemporaryMessageCmd, msg, delayMs);
}

export function onShowTemporaryMessage(cb: any, owner: any) {
  return on(showTemporaryMessageCmd, cb, owner);
}
