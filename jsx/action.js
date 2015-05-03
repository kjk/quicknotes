/* jshint -W097,-W117 */
'use strict';

// Loosely inspired by flux ideas.
// One part of the code can trigger an action by calling a function in this
// module. Other parts of the code can provide callbacks to be called when
// action is triggered.

// index is one of the above constants.
// value at a given index is [[cbFunc, cbId], ...]
var actionCallbacks = [];

// current global callback id to hand out in on()
// we don't bother recycling them after off()
var currCid = 0;

function getActionName(idx) {
  return actionNames[idx] + " (" + idx + ")";
}

function broadcast(actionIdx) {
  var callbacks = actionCallbacks[actionIdx];
  if (!callbacks || callbacks.length === 0) {
    console.log("action.broadcast: no callback for action", getActionName(actionIdx));
    return;
  }

  var args = Array.prototype.slice.call(arguments, 1);
  callbacks.map(function(cbInfo) {
    var cb = cbInfo[0];
    console.log("broadcastAction: calling callback for action", getActionName(actionIdx), "with", args.length, "args");
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
  var callbacks = actionCallbacks[action];
  var el = [cb, currCid];
  if (!callbacks) {
    actionCallbacks[action] = [el];
  } else {
    callbacks.push(el);
  }
  return currCid;
}

function off(actionIdx, cbId) {
  var callbacks = actionCallbacks[actionIdx];
  if (callbacks && callbacks.length > 0) {
    var n = callbacks.length;
    for (var i = 0; i < n; i++) {
      if (callbacks[i][1] === cbId) {
        callbacks.splice(i, 1);
        return
      }
    }
  }
  console.log("action.off: didn't find callback id", cbId, "for action", getActionName(actionIdx));
}

/* actions */

// index in actionCallbacks array for a given action
var showSettingsIdx = 0;
var hideSettingsIdx = 1;

// must be in same order as *Idx above
var actionNames = [
  "showSettings",
  "hideSettings",
];

function showSettings(name) {
  broadcast(showSettingsIdx, name);
}

function onShowSettings(cb) {
  return on(showSettingsIdx, cb);
}

function offShowSettings(cbId) {
  off(showSettingsIdx, cbId);
}

function hideSettings(view) {
  broadcast(hideSettingsIdx, view);
}

function onHideSettings(cb) {
  return on(hideSettingsIdx, cb);
}

function offHideSettings(cbId) {
  off(hideSettingsIdx, cbId);
}

module.exports = {
  showSettings: showSettings,
  onShowSettings: onShowSettings,
  offShowSettings: offShowSettings,

  hideSettings: hideSettings,
  onHideSettings: onHideSettings,
  offHideSettings: offHideSettings,
};
