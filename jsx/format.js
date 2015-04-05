/* jshint -W097,-W117 */
'use strict';

var Text = 0;
var Markdown = 1;

var Formats = ["text", "markdown"];

function numberToName(n) {
  return Formats[n];
}

function nameToNumber(s) {
  for (var i = 0; i < Formats.length; i++) {
    if (Formats[i] == s) {
      return i;
    }
  }
  return -1;
}

exports.numberToName = numberToName;
exports.nameToNumber = nameToNumber;
exports.Text = Text;
exports.Markdown = Markdown;
exports.Formats = Formats;
