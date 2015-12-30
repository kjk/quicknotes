/* jshint -W097,-W117 */
'use strict';

/* name <-> number mapping of note content formats */

const Invalid = 0;
const Text = 1;
const Markdown = 2;
const Html = 3;

const formatNames = ["invalid", "text", "markdown", "html"];

const Formats = ["text", "markdown"];

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
