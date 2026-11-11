// A small, readable HNSW (Malkov & Yashunin, 2016) — instrumented so the demos can replay every step.
import { mulberry32 } from './points.js';

export function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// Insert [distance, id] into an array kept sorted by distance (closest first).
function insort(arr, item) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid][0] < item[0]) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, item);
}

export class HNSW {
  constructor({ M = 6, efConstruction = 32, heuristic = true, mL, seed = 7 } = {}) {
    this.M = M;                       // max links per node on upper layers
    this.Mmax0 = 2 * M;               // max links per node on layer 0
    this.efConstruction = efConstruction;
    this.heuristic = heuristic;       // diverse neighbour selection (paper's Algorithm 4)
    this.mL = mL ?? 1 / Math.log(Math.max(M, 2));
    this.rand = mulberry32(seed);
    this.points = [];
    this.levels = [];
    this.links = [];                  // links[id][layer] = neighbour ids
    this.entry = -1;
    this.maxLevel = -1;
    this.distCount = 0;
  }

  dist(q, id) {
    this.distCount++;
    return euclid(q, this.points[id]);
  }

  randomLevel() {
    return Math.floor(-Math.log(1 - this.rand()) * this.mL);
  }

  // Best-first search on one layer, keeping the ef closest nodes found so far.
  searchLayer(q, entryPoints, ef, layer, trace) {
    const visited = new Set();
    const candidates = []; // nodes still to expand, closest first
    const results = [];    // best ef nodes so far, closest first

    for (const ep of entryPoints) {
      visited.add(ep);
      const d = this.dist(q, ep);
      trace?.push({ type: 'visit', layer, from: null, id: ep, d });
      insort(candidates, [d, ep]);
      insort(results, [d, ep]);
    }
    while (results.length > ef) results.pop();

    while (candidates.length) {
      const [dc, c] = candidates.shift();
      if (dc > results[results.length - 1][0]) break; // nothing left can improve the results
      trace?.push({ type: 'expand', layer, id: c });
      for (const e of this.links[c][layer]) {
        if (visited.has(e)) continue;
        visited.add(e);
        const de = this.dist(q, e);
        trace?.push({ type: 'visit', layer, from: c, id: e, d: de });
        if (results.length < ef || de < results[results.length - 1][0]) {
          insort(candidates, [de, e]);
          insort(results, [de, e]);
          if (results.length > ef) results.pop();
        }
      }
    }
    return results;
  }

  // cands: [distance to base, id], closest first.
  selectNeighbors(cands, M) {
    if (!this.heuristic) return cands.slice(0, M).map((c) => c[1]);
    const chosen = [];
    for (const [d, e] of cands) {
      if (chosen.length >= M) break;
      // Keep e only if it is closer to the base than to every neighbour already chosen.
      let diverse = true;
      for (const r of chosen) {
        this.distCount++;
        if (euclid(this.points[e], this.points[r]) < d) { diverse = false; break; }
      }
      if (diverse) chosen.push(e);
    }
    return chosen;
  }

  insert(p) {
    const id = this.points.length;
    const level = this.randomLevel();
    this.points.push(p);
    this.levels.push(level);
    this.links.push(Array.from({ length: level + 1 }, () => []));

    if (this.entry < 0) {
      this.entry = id;
      this.maxLevel = level;
      return id;
    }

    // Zoom in greedily through the layers above the new node's level.
    let ep = [this.entry];
    for (let l = this.maxLevel; l > level; l--) ep = [this.searchLayer(p, ep, 1, l)[0][1]];

    // On every layer the node lives on, find neighbours and link both ways.
    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const W = this.searchLayer(p, ep, this.efConstruction, l);
      const neighbours = this.selectNeighbors(W, this.M);
      this.links[id][l] = neighbours;
      const cap = l === 0 ? this.Mmax0 : this.M;
      for (const n of neighbours) {
        const nl = this.links[n][l];
        nl.push(id);
        if (nl.length > cap) {
          const scored = nl.map((x) => [this.dist(this.points[n], x), x]).sort((a, b) => a[0] - b[0]);
          this.links[n][l] = this.selectNeighbors(scored, cap);
        }
      }
      ep = W.map((w) => w[1]);
    }

    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entry = id;
    }
    return id;
  }

  search(q, k = 1, ef = k, trace) {
    if (this.entry < 0) return [];
    let ep = [this.entry];
    for (let l = this.maxLevel; l > 0; l--) ep = [this.searchLayer(q, ep, 1, l, trace)[0][1]];
    return this.searchLayer(q, ep, Math.max(ef, k), 0, trace).slice(0, k);
  }

  bruteForce(q, k = 1) {
    return this.points.map((p, i) => [euclid(q, p), i]).sort((a, b) => a[0] - b[0]).slice(0, k);
  }

  nodesAt(layer) {
    return this.levels.flatMap((lv, i) => (lv >= layer ? [i] : []));
  }

  // Undirected view of a layer's links (each pair once).
  edges(layer) {
    const out = [];
    this.links.forEach((ls, i) => {
      if (!ls[layer]) return;
      for (const j of ls[layer]) {
        if (i < j || !this.links[j][layer].includes(i)) out.push([i, j]);
      }
    });
    return out;
  }
}
