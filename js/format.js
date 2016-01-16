// name <-> number mapping of note content formats

export const Invalid = 0;
export const Text = 1;
export const Markdown = 2;
export const Html = 3;

export const InvalidId = 0;
export const TextId = 1;
export const MarkdownId = 2;
export const HtmlId = 3;

export const InvalidName = 'invalid';
export const TextName = 'text';
export const MarkdownName = 'markdown';
export const HtmlName = 'html';

const formatNames = [
  InvalidName,
  TextName,
  MarkdownName,
  HtmlName
];

export const Formats = [TextName, MarkdownName];
export const FormatNames = [TextName, MarkdownName];

export function NameFromId(n) {
  if (n >= formatNames.length) {
    return InvalidName;
  }
  return formatNames[n];
}

export function IdFromName(s) {
  var idx = formatNames.indexOf(s);
  if (idx == -1) {
    return Invalid;
  }
  return idx;
}
