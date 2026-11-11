export const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Convert a mouse event into the SVG's viewBox coordinates.
export function svgPoint(svg, evt) {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return [vb.x + ((evt.clientX - r.left) * vb.width) / r.width, vb.y + ((evt.clientY - r.top) * vb.height) / r.height];
}

export function line(parent, a, b, cls) {
  return el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }, parent);
}

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
