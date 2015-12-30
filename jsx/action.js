/* reusable part */

// Loosely inspired by flux ideas.
// One part of the code can trigger an action by calling a function in this
// module. Other parts of the code can provide callbacks to be called when
// action is triggered.

// index is one of the above constants.
// value at a given index is [[cbFunc, cbId], ...]
let actionCallbacks = [];

// current global callback id to hand out in on()
// we don't bother recycling them after off()
let currCid = 0;

function getActionName(idx) {
  return actionNames[idx] + " (" + idx + ")";
}

function broadcast(actionIdx) {
  const callbacks = actionCallbacks[actionIdx];
  if (!callbacks || callbacks.length === 0) {
    console.log("action.broadcast: no callback for action", getActionName(actionIdx));
    return;
  }

  const args = Array.prototype.slice.call(arguments, 1);
  callbacks.map(function(cbInfo) {
    const cb = cbInfo[0];
    console.log("action.broadcast: calling callback for action", getActionName(actionIdx), "args:", args);
    if (args.length > 0) {
      cb.apply(null, args);
    } else {
      cb();
    }
  });
}

// subscribe to be notified about an action.
// returns an id that can be used to unsubscribe with off()
function on(action, cb) {
  currCid++;
  const callbacks = actionCallbacks[action];
  const el = [cb, currCid];
  if (!callbacks) {
    actionCallbacks[action] = [el];
  } else {
    callbacks.push(el);
  }
  return currCid;
}

function off(actionIdx, cbId) {
  const callbacks = actionCallbacks[actionIdx];
  if (callbacks && callbacks.length > 0) {
    const n = callbacks.length;
    for (let i = 0; i < n; i++) {
      if (callbacks[i][1] === cbId) {
        callbacks.splice(i, 1);
        return;
      }
    }
  }
  console.log("action.off: didn't find callback id", cbId, "for action", getActionName(actionIdx));
}

/* actions specific to an app */

// index in actionCallbacks array for a given action
const showSettingsIdx = 0;
const hideSettingsIdx = 1;
const tagSelectedIdx = 2;

// must be in same order as *Idx above
const actionNames = [
  "showSettings",
  "hideSettings",
  "tagSelected",
];

export function showSettings(name) {
  broadcast(showSettingsIdx, name);
}

export function onShowSettings(cb) {
  return on(showSettingsIdx, cb);
}

export function offShowSettings(cbId) {
  off(showSettingsIdx, cbId);
}

export function hideSettings(view) {
  broadcast(hideSettingsIdx, view);
}

export function onHideSettings(cb) {
  return on(hideSettingsIdx, cb);
}

export function offHideSettings(cbId) {
  off(hideSettingsIdx, cbId);
}

export function tagSelected(tag) {
  broadcast(tagSelectedIdx, tag);
}

export function onTagSelected(cb) {
  return on(tagSelectedIdx, cb);
}

export function offTagSelected(cbId) {
  off(tagSelectedIdx, cbId);
}
