"use strict";
/**
 * Zap Standard Library — math
 * import math from "zap:math"
 */
module.exports = {
  PI:     Math.PI,
  E:      Math.E,
  TAU:    Math.PI * 2,
  INF:    Infinity,

  abs:    (x)    => Math.abs(x),
  sqrt:   (x)    => Math.sqrt(x),
  cbrt:   (x)    => Math.cbrt(x),
  pow:    (x, y) => Math.pow(x, y),
  exp:    (x)    => Math.exp(x),
  log:    (x)    => Math.log(x),
  log2:   (x)    => Math.log2(x),
  log10:  (x)    => Math.log10(x),

  floor:  (x)    => Math.floor(x),
  ceil:   (x)    => Math.ceil(x),
  round:  (x)    => Math.round(x),
  trunc:  (x)    => Math.trunc(x),

  min:    (...a) => Math.min(...a),
  max:    (...a) => Math.max(...a),
  clamp:  (x, lo, hi) => Math.min(Math.max(x, lo), hi),

  sin:    (x)    => Math.sin(x),
  cos:    (x)    => Math.cos(x),
  tan:    (x)    => Math.tan(x),
  asin:   (x)    => Math.asin(x),
  acos:   (x)    => Math.acos(x),
  atan:   (x)    => Math.atan(x),
  atan2:  (y, x) => Math.atan2(y, x),

  sign:   (x)    => Math.sign(x),
  hypot:  (...a) => Math.hypot(...a),

  random:    ()          => Math.random(),
  randomInt: (lo, hi)    => Math.floor(Math.random() * (hi - lo)) + lo,
  randomFloat: (lo, hi)  => Math.random() * (hi - lo) + lo,

  isEven: (n)    => n % 2 === 0,
  isOdd:  (n)    => n % 2 !== 0,
  isPrime: (n)   => {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
    return true;
  },

  factorial: (n) => {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  },

  gcd: (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; },
  lcm: (a, b) => Math.abs(a * b) / module.exports.gcd(a, b),

  sum:    (arr) => arr.reduce((a, b) => a + b, 0),
  avg:    (arr) => arr.reduce((a, b) => a + b, 0) / arr.length,
  median: (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
  },
  range:  (a, b, step = 1) => {
    const r = [];
    for (let i = a; i < b; i += step) r.push(i);
    return r;
  },

  toDeg:  (rad)  => rad * (180 / Math.PI),
  toRad:  (deg)  => deg * (Math.PI / 180),
};
