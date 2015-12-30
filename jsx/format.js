// name <-> number mapping of note content formats

const Invalid = 0;
export const Text = 1;
export const Markdown = 2;
export const Html = 3;

const formatNames = ["invalid", "text", "markdown", "html"];

export const Formats = ["text", "markdown"];

export function numberToName(n) {
  if (n >= formatNames.length) {
    return "invalid";
  }
  return formatNames[n];
}

export function nameToNumber(s) {
  for (var i = 0; i < formatNames.length; i++) {
    if (formatNames[i] == s) {
      return i;
    }
  }
  return Invalid;
}
