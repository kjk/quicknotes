/* jshint -W097,-W117 */
'use strict';

// An action is a function in this module.
// One can also subscribe to get notified about the action.

// array of callbacks.
var subscribers = [];

// index in subscribers array for a given action
var showSettings = 0;
var hideSettings = 1;

// TODO: unsubscribe

function notifyAction(action) {
  var cb = subscribers[action];
  if (cb) {
    console.log("notifyAction: calling callback ", cb, " for action ", action);
    cb();
  } else {
    console.log("notifyAction: no callback for action ", action);
  }
}

function subscribeToAction(action, cb) {
  var currentCb = subscribers[action];
  if (currentCb) {
    console.log("subscribeToAction: already has a callback for action ", action, " will over-write");
  }
  subscribers[action] = cb;
}

function notifyShowSettings() {
  notifyAction(showSettings);
}
function subscribeToShowSettings(cb) {
  subscribeToAction(showSettings, cb);
}
function notifyHideSettings() {
  notifyAction(hideSettings);
}
function subscribeToHideSettings(cb) {
  subscribeToAction(hideSettings, cb);
}

exports.notifyShowSettings = notifyShowSettings;
exports.subscribeToShowSettings = subscribeToShowSettings;
exports.notifyHideSettings = notifyHideSettings;
exports.subscribeToHideSettings = subscribeToHideSettings;
