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

// TODO: rename to NameFromId
export function numberToName(n) {
  if (n >= formatNames.length) {
    return InvalidName;
  }
  return formatNames[n];
}

// TODO: rename to IdFromName
export function nameToNumber(s) {
  for (let [idx, val] of formatNames) {
    if (val == s) {
      return idx;
    }
  }
  return Invalid;
}

export { nameToNumber as IdFromName, numberToName as NameFromId };
