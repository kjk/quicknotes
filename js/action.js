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

function broadcast(actionCmd) {
  const callbacks = registeredActions[actionCmd];
  if (!callbacks || callbacks.length === 0) {
    console.log('action.broadcast: no callback for action', actionCmd);
    return;
  }

  const args = Array.prototype.slice.call(arguments, 1);
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
  const el = [cb, currCid, owner];
  if (!callbacks) {
    registeredActions[actionCmd] = [el];
  } else {
    callbacks.push(el);
  }
  return currCid;
}

export function off(actionCmd, cbIdOrOwner) {
  const callbacks = registeredActions[actionCmd];
  if (callbacks && callbacks.length > 0) {
    const n = callbacks.length;
    for (let i = 0; i < n; i++) {
      const cb = callbacks[i];
      if (cb[1] === cbIdOrOwner || cb[2] === cbIdOrOwner) {
        callbacks.splice(i, 1);
        return;
      }
    }
  }
  //console.log("action.off: didn't find callback id", cbId, "for action", actionCmd);
}

export function offAllForOwner(owner) {
  for (let actionCmd in registeredActions) {
    off(actionCmd, owner);
  }
}

/* actions specific to an app */

// key in registeredActions
const showSettingsCmd = 'showSettings';
const hideSettingsCmd = 'hideSettings';
const tagSelectedCmd = 'tagSelected';

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
