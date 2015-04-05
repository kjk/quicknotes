/* jshint -W097,-W117 */
'use strict';

var Text = 0;
var Markdown = 1;

var Formats = ["text", "markdown"];

function numberToText(n) {
  return Formats[n];
}

exports.numberToText = numberToText;
exports.Text = Text;
exports.Markdown = Markdown;
exports.Formats = Formats;
