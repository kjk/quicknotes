console.log('preload.js');

// TODO: I tried to do require('electron') in browser code
// but it fails trying to require 'fs' module, even though
// I can do require('fs') in console.
// What works is making electron available globally here

// http://electron.atom.io/docs/api/process/#event-loaded

// TODO: only works for the first window but not for windows
// opened automatically due to clicking a link
//const _electron = require('electron');
/*
process.once('loaded', () => {
  console.log('preload: set global.electron');
  global.electron = _electron;
})
*/
