const child_process = require('child_process');
const fs = require('fs');
// const promisify = require('../promisify');
const AWS = require('aws-sdk');

const s3Bucket = 'kjkpub';
const s3Prefix = 'software/quicknotes/';
// const s3Prefix = 'software/dbhero/';
const s3PathRel = `${s3Prefix}rel/`;
const s3PathRelMac = `${s3PathRel}mac/`;

/*
s3 urls:
kjkpub/software/quicknotes/
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

function isMac() { return process.platform === 'darwin'; }
function isWin() { return process.platform === 'win32'; }
function assert(cond, msg) { if (!cond) { throw Error(msg); } }

const o = JSON.parse(fs.readFileSync('package.json'));
const ver = o.version;
console.log('ver:', ver);

const s3PathMacZip = `${s3PathRelMac}QuickNotes-${ver}.zip`;
const s3PathMacDmg = `${s3PathRelMac}QuickNotes-${ver}.dmg`;

var credentials = new AWS.SharedIniFileCredentials({profile: 'default'});
AWS.config.credentials = credentials;

var s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  params: { Bucket: s3Bucket }
});

// const s3ListObjects = promisify(s3.listObjects);
// const s3Upload = promisify(s3.upload);

function checkFilesNotExist(allFiles, toCheck) {
  toCheck.forEach(file => {
    if (allFiles.includes(file)) {
      throw Error(`file ${fiel} already exists in s3`);
    }
  });
}

function checkFileExists(path) {
  assert(fs.existsSync(path), `file ${path} doesn't exist`);
}

const params = {
  // Bucket: s3Bucket,
  // Delimiter: '/',
  Prefix: s3Prefix,
}

s3.listObjects(params, function (err, data) {
  if (err) {
    throw Error(err);
  }

  const files = data.Contents.map( e => e.Key );
  console.log(files);
  if (isMac()) {
    checkFilesNotExist(files, [s3PathMacZip, s3PathMacDmg]);
    s3BuildAndUploadMac();
  } else {
    throw Error('only Mac is supported');
  }
});

function s3UploadPublic(s3Path, localPath) {
  console.log('s3Path:', s3Path, 'localPath:', localPath);
  // s3.upload
}

function s3BuildAndUploadMac() {
  child_process.execSync('./node_modules/.bin/build');
  const pathMacZip = `dist/mac/QuickNotes-${ver}-mac.zip`;
  const pathMacDmg = `dist/mac/QuickNotes-${ver}.dmg`;
  checkFileExists(pathMacZip);
  checkFileExists(pathMacDmg);

  s3UploadPublic(s3PathMacZip, pathMacZip);
  s3UploadPublic(s3PathMacDmg, pathMacDmg);

}
