/* jshint -W097,-W117 */
'use strict';

/* name <-> number mapping of note content formats */

var Invalid = 0;
var Text = 1;
var Markdown = 2;
var Html = 3;

var formatNames = ["invalid", "text", "markdown", "html"];

var Formats = ["text", "markdown"];

function numberToName(n) {
  if (n >= formatNames.length) {
    return "invalid";
  }
  return formatNames[n];
}

function nameToNumber(s) {
  for (var i = 0; i < formatNames.length; i++) {
    if (formatNames[i] == s) {
      return i;
    }
  }
  return Invalid;
}

exports.numberToName = numberToName;
exports.nameToNumber = nameToNumber;
exports.Text = Text;
exports.Markdown = Markdown;
exports.Formats = Formats;
