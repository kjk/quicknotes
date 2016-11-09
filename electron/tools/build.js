const child_process = require('child_process');
const fs = require('fs');

const S3_ACCESS = '';
const S3_SECRET = '';

const o = JSON.parse(fs.readFileSync('package.json'));
const ver = o.version;
console.log('ver:', ver);

/*
s3 urls:
kjkpub/software/
  lastvermac.js
  lastverwin.js
  rel/
    mac/
      QuickNotes-${ver}.zip
      QuickNotes-${ver}.dmg
    win/
      QuickNotes-32-${ver}.exe
      QuickNotes-64-${ver}.exe
*/

// child_process.execSync('./node_modules/.bin/build');

