/* reusable part */

// Loosely inspired by flux ideas.
// One part of the code can trigger an action by calling a function in this
// module. Other parts of the code can provide callbacks to be called when
// action is triggered.

// index is one of the above constants.
// value at a given index is [[cbFunc, cbId], ...]
let registeredActions = {};

// current global callback id to hand out in on()
// we don't bother recycling them after off()
let currCid = 0;

function slice(iter, n) {
  return Array.prototype.slice.call(iter, n);
}

function broadcast(actionCmd) {
  const callbacks = registeredActions[actionCmd];
  if (!callbacks || callbacks.length === 0) {
    console.log('action.broadcast: no callback for action', actionCmd);
    return;
  }

  const args = slice(arguments, 1);
  //const args = Array.prototype.slice.call(arguments, 1);
  for (let cbInfo of callbacks) {
    const cb = cbInfo[0];
    console.log('action.broadcast: calling callback for action', actionCmd, 'args:', args);
    if (args.length > 0) {
      cb.apply(null, args);
    } else {
      cb();
    }
  }
}

// subscribe to be notified about an action.
// returns an id that can be used to unsubscribe with off()
export function on(actionCmd, cb, owner) {
  currCid++;
  const callbacks = registeredActions[actionCmd];
  const cbInfo = [cb, currCid, owner];
  if (!callbacks) {
    registeredActions[actionCmd] = [cbInfo];
  } else {
    callbacks.push(cbInfo);
  }
  return currCid;
}

export function off(actionCmd, cbIdOrOwner) {
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

export function offAllForOwner(owner) {
  for (let actionCmd in registeredActions) {
    off(actionCmd, owner);
  }
}

/* actions specific to an app */

// key in registeredActions
// TODO: replace with showHideSettingsCmd
const showSettingsCmd = 'showSettings';
const hideSettingsCmd = 'hideSettings';
const tagSelectedCmd = 'tagSelected';
const showHideImportSimpleNoteCmd = 'showHideImportSimpleNote';
const reloadNotesCmd = 'reloadNotes';

export function showSettings(name) {
  broadcast(showSettingsCmd, name);
}

export function onShowSettings(cb, owner) {
  return on(showSettingsCmd, cb, owner);
}

export function hideSettings(view) {
  broadcast(hideSettingsCmd, view);
}

export function onHideSettings(cb, owner) {
  return on(hideSettingsCmd, cb, owner);
}

export function tagSelected(tag) {
  broadcast(tagSelectedCmd, tag);
}

export function onTagSelected(cb, owner) {
  return on(tagSelectedCmd, cb, owner);
}

export function onShowHideImportSimpleNote(cb, owner) {
  return on(showHideImportSimpleNoteCmd, cb, owner);
}

export function showHideImportSimpleNote(shouldShow) {
  broadcast(showHideImportSimpleNoteCmd, shouldShow);
}

export function reloadNotes() {
  broadcast(reloadNotesCmd);
}

export function onReloadNotes(cb, owner) {
  return on(reloadNotesCmd, cb, owner);
}
