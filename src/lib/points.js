export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomPoints(n, w, h, rand, pad = 12) {
  return Array.from({ length: n }, () => [pad + rand() * (w - 2 * pad), pad + rand() * (h - 2 * pad)]);
}

export function gaussian(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export function clusteredPoints(n, w, h, rand, clusters = 8, spread = 18, pad = 12) {
  const centres = Array.from({ length: clusters }, () => [60 + rand() * (w - 120), 60 + rand() * (h - 120)]);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return Array.from({ length: n }, () => {
    const [cx, cy] = centres[Math.floor(rand() * clusters)];
    return [clamp(cx + gaussian(rand) * spread, pad, w - pad), clamp(cy + gaussian(rand) * spread, pad, h - pad)];
  });
}

export function gaussianVectors(n, dim, rand) {
  return Array.from({ length: n }, () => Array.from({ length: dim }, () => gaussian(rand)));
}
