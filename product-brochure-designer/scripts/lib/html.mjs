// A small reader for the skill's static, explicitly closed HTML templates.
// This is not a browser DOM or a CSS/layout validator.
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const NON_COPY = new Set(['head', 'script', 'style', 'template']);
const BLOCK = new Set('section div p h1 h2 h3 h4 header footer li dt dd br'.split(' '));

export function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const hex = entity[1].toLowerCase() === 'x';
    const point = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\uFFFD';
  });
}

function attributes(token) {
  const attrs = {};
  const body = token.replace(/^<[^\s/>]+/, '').replace(/\/?\s*>$/, '');
  const attr = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of body.matchAll(attr)) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

export function parseHtml(source) {
  const root = { tag: '#document', attrs: {}, children: [], source, contentStart: 0, contentEnd: source.length };
  const stack = [root];
  const tokens = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][a-z\d:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  let cursor = 0;
  let match;
  const appendText = (end) => {
    if (end > cursor) stack.at(-1).children.push({ tag: '#text', value: source.slice(cursor, end) });
  };
  while ((match = tokens.exec(source))) {
    appendText(match.index);
    const token = match[0];
    cursor = tokens.lastIndex;
    if (token.startsWith('<!')) continue;
    const tag = token.match(/^<\/?([\w:-]+)/)[1].toLowerCase();
    if (token.startsWith('</')) {
      const index = stack.findLastIndex((node) => node.tag === tag);
      if (index > 0) {
        for (const node of stack.splice(index)) node.contentEnd = match.index;
      }
      continue;
    }
    const node = { tag, attrs: attributes(token), children: [], source, contentStart: cursor, contentEnd: source.length };
    stack.at(-1).children.push(node);
    if (VOID.has(tag) || /\/\s*>$/.test(token)) { node.contentEnd = cursor; continue; }
    if (tag === 'script' || tag === 'style') {
      const close = new RegExp(`</${tag}\\s*>`, 'gi');
      close.lastIndex = cursor;
      const end = close.exec(source);
      node.children.push({ tag: '#text', value: source.slice(cursor, end?.index ?? source.length) });
      node.contentEnd = end?.index ?? source.length;
      cursor = end ? close.lastIndex : source.length;
      tokens.lastIndex = cursor;
    } else stack.push(node);
  }
  appendText(source.length);
  return root;
}

export function elements(root, predicate = () => true) {
  const found = [];
  for (const child of root.children || []) {
    if (child.tag === '#text') continue;
    if (predicate(child)) found.push(child);
    found.push(...elements(child, predicate));
  }
  return found;
}

export const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
export const innerHtml = (node) => node.source.slice(node.contentStart, node.contentEnd);

export function textContent(node) {
  if (node.tag === '#text') return decodeEntities(node.value);
  if (NON_COPY.has(node.tag)) return '';
  const value = (node.children || []).map(textContent).join('');
  return BLOCK.has(node.tag) ? `${value}\n` : value;
}

export function byClass(html, name) {
  return elements(typeof html === 'string' ? parseHtml(html) : html, (node) => hasClass(node, name));
}

export function imageReferences(root) {
  const references = [];
  const urls = (css) => {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/gi, '');
    for (const m of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
      const value = (m[1] ?? m[2] ?? m[3]).trim();
      if (value && !value.startsWith('#')) references.push(value);
    }
  };
  for (const node of elements(root)) {
    if (node.tag === 'img' && (node.attrs.src || !node.attrs.srcset)) references.push(node.attrs.src || '');
    if (['img', 'source'].includes(node.tag) && node.attrs.srcset) {
      // Inline data URIs are reported as non-local rather than guessed at.
      if (/^data:/i.test(node.attrs.srcset)) references.push(node.attrs.srcset);
      else for (const entry of node.attrs.srcset.split(',')) references.push(entry.trim().split(/\s+/)[0]);
    }
    if (node.tag === 'style') urls(innerHtml(node));
    if (node.attrs.style) urls(node.attrs.style);
    if (node.tag === 'image') references.push(node.attrs.href || node.attrs['xlink:href'] || '');
  }
  return [...new Set(references)];
}
