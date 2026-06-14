"use strict";
/**
 * Zap Standard Library — time
 * import time from "zap:time"
 */
module.exports = {
  now:        () => Date.now(),
  seconds:    () => Math.floor(Date.now() / 1000),
  date:       () => new Date().toISOString(),
  dateLocal:  () => new Date().toLocaleString(),
  year:       () => new Date().getFullYear(),
  month:      () => new Date().getMonth() + 1,
  day:        () => new Date().getDate(),
  hour:       () => new Date().getHours(),
  minute:     () => new Date().getMinutes(),
  second:     () => new Date().getSeconds(),

  format(ts, fmt = "YYYY-MM-DD HH:mm:ss") {
    const d = new Date(ts ?? Date.now());
    return fmt
      .replace("YYYY", d.getFullYear())
      .replace("MM",   String(d.getMonth()+1).padStart(2,"0"))
      .replace("DD",   String(d.getDate()).padStart(2,"0"))
      .replace("HH",   String(d.getHours()).padStart(2,"0"))
      .replace("mm",   String(d.getMinutes()).padStart(2,"0"))
      .replace("ss",   String(d.getSeconds()).padStart(2,"0"));
  },

  sleep: (ms)  => new Promise(r => setTimeout(r, ms)),

  since: (ts)  => Date.now() - ts,

  elapsed(fn) {
    const start = Date.now();
    fn();
    return Date.now() - start;
  },

  async elapsedAsync(fn) {
    const start = Date.now();
    await fn();
    return Date.now() - start;
  },

  MS:  1,
  SEC: 1000,
  MIN: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY:  24 * 60 * 60 * 1000,
};
