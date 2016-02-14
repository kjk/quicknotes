'use strict';

import marked from 'marked';
import MarkdownIt from 'markdown-it';

const renderer = new marked.Renderer();

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

function toHtmlMarked(s) {
  s = s.trim();
  const html = marked(s, markedOpts);
  return html;
}

const markdownItOpts = {
  html: false,
  linkify: true,
  breaks: false, // Convert '\n' in paragraphs into <br>
  typographer: false
};

const markdownIt = new MarkdownIt(markdownItOpts);

// https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md
// Remember old renderer, if overriden, or proxy to default renderer
var defaultRender = markdownIt.renderer.rules.link_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};

markdownIt.renderer.rules.link_open = function(tokens, idx, options, env, self) {
  // If you are sure other plugins can't add `target` - drop check below
  var aIndex = tokens[idx].attrIndex('target');

  if (aIndex < 0) {
    tokens[idx].attrPush(['target', '_blank']); // add new attribute
  } else {
    tokens[idx].attrs[aIndex][1] = '_blank'; // replace value of existing attr
  }

  // pass token to default renderer.
  return defaultRender(tokens, idx, options, env, self);
};

function toHtmlMarkdownIt(s) {
  s = s.trim();
  const html = markdownIt.render(s);
  return html;
}

export function toHtml(s) {
  return toHtmlMarkdownIt(s);
  // return toHtmlMarked(s);
}
