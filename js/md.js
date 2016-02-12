import marked from 'marked';

const renderer = new marked.Renderer();

const markedOpts = {
  renderer: renderer,
  gfm: true,
  tables: true,
  breaks: true,
  pedantic: false,
  sanitize: true,
  smartLists: true,
  smartypants: false
};


// like https://github.com/chjj/marked/blob/master/lib/marked.js#L869
// but adds target="_blank"
renderer.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase();
    } catch (e) {
      return '';
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
      return '';
    }
  }
  var out = '<a href="' + href + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += 'target="_blank" rel="nofollow"';
  out += '>' + text + '</a>';
  return out;
};

function toHtmlMarked(s) {
  s = s.trim();
  const html = marked(s, markedOpts);
  return html;
}

export function toHtml(s) {
  return toHtmlMarked(s);
}