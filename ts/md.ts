import * as hljs from 'highlight.js';
import * as showdown from 'showdown';

// copied from marked.js
function unescape(html: string) {
  // explicitly match decimal, hex, and named HTML entities
  return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/g, function(_, n) {
    n = n.toLowerCase();
    if (n === 'colon') return ':';
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1));
    }
    return '';
  });
}

// https://github.com/cybercase/showdown-target-blank/blob/master/src/target_blank.js
const showdownTargetBlank: showdown.RegexReplaceExtension = {
  type: 'output',
  regex: '<a(.*?)>',
  replace: function(match: any, content: string) {
    return content.indexOf('mailto:') !== -1
      ? '<a' + content + '>'
      : '<a target="_blank"' + content + '>';
  },
};

showdown.extension('targetblank', () => {
  return showdownTargetBlank;
});

function toHtmlShowdown(s: string): string {
  const opts: showdown.ConverterOptions = {
    tables: true,
    strikethrough: true,
    ghCodeBlocks: true,
    tasklists: true,
    smoothLivePreview: true,
    extensions: ['targetblank'],
  };
  const converter = new showdown.Converter(opts);
  converter.setFlavor('github');
  const html = converter.makeHtml(s);
  return html;
}

export function toHtml(s: string) {
  return toHtmlShowdown(s);
}
