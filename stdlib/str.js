"use strict";
/**
 * Zap Standard Library — str (String utilities)
 * import str from "zap:str"
 */
module.exports = {
  upper:      (s)       => String(s).toUpperCase(),
  lower:      (s)       => String(s).toLowerCase(),
  trim:       (s)       => String(s).trim(),
  trimStart:  (s)       => String(s).trimStart(),
  trimEnd:    (s)       => String(s).trimEnd(),
  reverse:    (s)       => String(s).split("").reverse().join(""),
  repeat:     (s, n)    => String(s).repeat(n),
  padStart:   (s, n, c) => String(s).padStart(n, c ?? " "),
  padEnd:     (s, n, c) => String(s).padEnd(n, c ?? " "),

  includes:   (s, sub)  => String(s).includes(sub),
  startsWith: (s, pre)  => String(s).startsWith(pre),
  endsWith:   (s, suf)  => String(s).endsWith(suf),

  replace:    (s, a, b) => String(s).replace(a, b),
  replaceAll: (s, a, b) => String(s).replaceAll(a, b),

  split:      (s, sep)  => String(s).split(sep ?? ""),
  lines:      (s)       => String(s).split("\n"),
  chars:      (s)       => String(s).split(""),
  words:      (s)       => String(s).trim().split(/\s+/),

  slice:      (s, a, b) => String(s).slice(a, b),
  charAt:     (s, i)    => String(s).charAt(i),
  charCode:   (s, i)    => String(s).charCodeAt(i),
  fromCode:   (n)       => String.fromCharCode(n),

  count(s, sub) {
    let n = 0, i = 0;
    while ((i = s.indexOf(sub, i)) !== -1) { n++; i += sub.length; }
    return n;
  },

  capitalize: (s)       => s.charAt(0).toUpperCase() + s.slice(1),
  titleCase:  (s)       => s.replace(/\b\w/g, c => c.toUpperCase()),
  camelCase:  (s)       => s.replace(/[-_ ](.)/g, (_, c) => c.toUpperCase()),
  snakeCase:  (s)       => s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, ""),
  kebabCase:  (s)       => s.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "").replace(/_/g, "-"),

  isAlpha:    (s)       => /^[a-zA-Z]+$/.test(s),
  isDigit:    (s)       => /^\d+$/.test(s),
  isAlphaNum: (s)       => /^[a-zA-Z0-9]+$/.test(s),
  isEmail:    (s)       => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  isUrl:      (s)       => { try { new URL(s); return true; } catch { return false; } },

  format:     (tmpl, obj) => tmpl.replace(/\{(\w+)\}/g, (_, k) => obj[k] ?? ""),

  len:        (s)       => String(s).length,
  isEmpty:    (s)       => !s || String(s).length === 0,
  isBlank:    (s)       => !s || String(s).trim().length === 0,
};
