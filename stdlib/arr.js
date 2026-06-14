"use strict";
/**
 * Zap Standard Library — arr (Array utilities)
 * import arr from "zap:arr"
 */
module.exports = {
  // ── Basics ────────────────────────────────────────────────────────
  len:      (a)       => a.length,
  first:    (a)       => a[0],
  last:     (a)       => a[a.length - 1],
  get:      (a, i)    => a[i < 0 ? a.length + i : i],
  isEmpty:  (a)       => !a || a.length === 0,

  // ── Mutation ──────────────────────────────────────────────────────
  push:     (a, ...v) => { a.push(...v); return a; },
  pop:      (a)       => a.pop(),
  shift:    (a)       => a.shift(),
  unshift:  (a, ...v) => { a.unshift(...v); return a; },
  insert:   (a, i, v) => { a.splice(i, 0, v); return a; },
  remove:   (a, i)    => { a.splice(i, 1); return a; },

  // ── Immutable transforms ──────────────────────────────────────────
  map:      (a, fn)       => a.map(fn),
  filter:   (a, fn)       => a.filter(fn),
  reduce:   (a, fn, init) => a.reduce(fn, init),
  find:     (a, fn)       => a.find(fn),
  findIdx:  (a, fn)       => a.findIndex(fn),
  every:    (a, fn)       => a.every(fn),
  some:     (a, fn)       => a.some(fn),
  includes: (a, v)        => a.includes(v),
  indexOf:  (a, v)        => a.indexOf(v),
  count:    (a, fn)       => a.filter(fn).length,

  slice:    (a, s, e)   => a.slice(s, e),
  flat:     (a, d)      => a.flat(d ?? 1),
  flatMap:  (a, fn)     => a.flatMap(fn),

  reverse:  (a)         => [...a].reverse(),
  sort:     (a, fn)     => [...a].sort(fn),
  sortBy:   (a, key)    => [...a].sort((x, y) => x[key] > y[key] ? 1 : -1),
  sortDesc: (a)         => [...a].sort((x, y) => y - x),
  sortAsc:  (a)         => [...a].sort((x, y) => x - y),

  unique:   (a)         => [...new Set(a)],
  uniqueBy: (a, key)    => [...new Map(a.map(x => [x[key], x])).values()],
  compact:  (a)         => a.filter(Boolean),
  flatten:  (a)         => a.flat(Infinity),

  zip:      (...arrs)   => arrs[0].map((_, i) => arrs.map(a => a[i])),
  unzip:    (a)         => a[0].map((_, i) => a.map(row => row[i])),
  chunk:    (a, n)      => { const r = []; for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i+n)); return r; },
  groupBy:  (a, key)    => a.reduce((m, x) => { (m[x[key]] ??= []).push(x); return m; }, {}),

  join:     (a, sep)    => a.join(sep ?? ","),
  concat:   (...arrs)   => [].concat(...arrs),

  // ── Math on arrays ────────────────────────────────────────────────
  sum:      (a)         => a.reduce((s, x) => s + x, 0),
  avg:      (a)         => a.reduce((s, x) => s + x, 0) / a.length,
  min:      (a)         => Math.min(...a),
  max:      (a)         => Math.max(...a),
  range:    (a, b, s=1) => { const r=[]; for(let i=a; i<b; i+=s) r.push(i); return r; },

  shuffle(a) {
    const r = [...a];
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  },

  sample:   (a, n = 1) => module.exports.shuffle(a).slice(0, n),
  pick:     (a)         => a[Math.floor(Math.random() * a.length)],
};
