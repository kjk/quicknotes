/* reusable part */

// Loosely inspired by flux ideas.
// One part of the code can trigger an action by calling a function in this
// module. Other parts of the code can provide callbacks to be called when
// action is triggered.

// index is one of the above constants.
// value at a given index is [[cbFunc, cbId], ...]
let actionCallbacks = {};

// current global callback id to hand out in on()
// we don't bother recycling them after off()
let currCid = 0;

function broadcast(actionCmd) {
  const callbacks = actionCallbacks[actionCmd];
  if (!callbacks || callbacks.length === 0) {
    console.log("action.broadcast: no callback for action", actionCmd);
    return;
  }

  const args = Array.prototype.slice.call(arguments, 1);
  for (let cbInfo of callbacks) {
    const cb = cbInfo[0];
    console.log("action.broadcast: calling callback for action", actionCmd, "args:", args);
    if (args.length > 0) {
      cb.apply(null, args);
    } else {
      cb();
    }
  }
}

// subscribe to be notified about an action.
// returns an id that can be used to unsubscribe with off()
export function on(actionCmd, cb) {
  currCid++;
  const callbacks = actionCallbacks[actionCmd];
  const el = [cb, currCid];
  if (!callbacks) {
    actionCallbacks[actionCmd] = [el];
  } else {
    callbacks.push(el);
  }
  return currCid;
}

export function off(actionCmd, cbId) {
  const callbacks = actionCallbacks[actionCmd];
  if (callbacks && callbacks.length > 0) {
    const n = callbacks.length;
    for (let i = 0; i < n; i++) {
      if (callbacks[i][1] === cbId) {
        callbacks.splice(i, 1);
        return;
      }
    }
  }
  console.log("action.off: didn't find callback id", cbId, "for action", actionCmd);
}

/* actions specific to an app */

// index in actionCallbacks array for a given action
const showSettingsCmd = "showSettings";
const hideSettingsCmd = "hideSettings";
const tagSelectedCmd = "tagSelected";

export function showSettings(name) {
  broadcast(showSettingsCmd, name);
}

export function onShowSettings(cb) {
  return on(showSettingsCmd, cb);
}

export function offShowSettings(cbId) {
  off(showSettingsCmd, cbId);
}

export function hideSettings(view) {
  broadcast(hideSettingsCmd, view);
}

export function onHideSettings(cb) {
  return on(hideSettingsCmd, cb);
}

export function offHideSettings(cbId) {
  off(hideSettingsCmd, cbId);
}

export function tagSelected(tag) {
  broadcast(tagSelectedCmd, tag);
}

export function onTagSelected(cb) {
  return on(tagSelectedCmd, cb);
}

export function offTagSelected(cbId) {
  off(tagSelectedCmd, cbId);
}
