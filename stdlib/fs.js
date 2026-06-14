"use strict";
/**
 * Zap Standard Library — fs (File System)
 * import fs from "zap:fs"
 */
const _fs   = require("fs");
const _path = require("path");

module.exports = {
  // ── Read ──────────────────────────────────────────────────────────
  readFile(path) {
    try { return _fs.readFileSync(path, "utf-8"); }
    catch(e) { throw new Error(`fs.readFile: ${e.message}`); }
  },

  readBytes(path) {
    try { return _fs.readFileSync(path); }
    catch(e) { throw new Error(`fs.readBytes: ${e.message}`); }
  },

  readLines(path) {
    try { return _fs.readFileSync(path, "utf-8").split("\n"); }
    catch(e) { throw new Error(`fs.readLines: ${e.message}`); }
  },

  readJSON(path) {
    try { return JSON.parse(_fs.readFileSync(path, "utf-8")); }
    catch(e) { throw new Error(`fs.readJSON: ${e.message}`); }
  },

  // ── Write ─────────────────────────────────────────────────────────
  writeFile(path, content) {
    try { _fs.writeFileSync(path, content, "utf-8"); return true; }
    catch(e) { throw new Error(`fs.writeFile: ${e.message}`); }
  },

  writeJSON(path, data, pretty = true) {
    try {
      _fs.writeFileSync(path, JSON.stringify(data, null, pretty ? 2 : 0), "utf-8");
      return true;
    } catch(e) { throw new Error(`fs.writeJSON: ${e.message}`); }
  },

  appendFile(path, content) {
    try { _fs.appendFileSync(path, content, "utf-8"); return true; }
    catch(e) { throw new Error(`fs.appendFile: ${e.message}`); }
  },

  // ── Check ─────────────────────────────────────────────────────────
  exists(path)   { return _fs.existsSync(path); },
  isFile(path)   { try { return _fs.statSync(path).isFile(); }   catch { return false; } },
  isDir(path)    { try { return _fs.statSync(path).isDirectory(); } catch { return false; } },

  size(path) {
    try { return _fs.statSync(path).size; }
    catch(e) { throw new Error(`fs.size: ${e.message}`); }
  },

  // ── Directory ─────────────────────────────────────────────────────
  mkdir(path) {
    try { _fs.mkdirSync(path, { recursive: true }); return true; }
    catch(e) { throw new Error(`fs.mkdir: ${e.message}`); }
  },

  listDir(path = ".") {
    try { return _fs.readdirSync(path); }
    catch(e) { throw new Error(`fs.listDir: ${e.message}`); }
  },

  listFiles(dir = ".") {
    try {
      return _fs.readdirSync(dir).filter(f =>
        _fs.statSync(_path.join(dir, f)).isFile()
      );
    } catch(e) { throw new Error(`fs.listFiles: ${e.message}`); }
  },

  // ── Delete ────────────────────────────────────────────────────────
  deleteFile(path) {
    try { _fs.unlinkSync(path); return true; }
    catch(e) { throw new Error(`fs.deleteFile: ${e.message}`); }
  },

  deleteDir(path) {
    try { _fs.rmSync(path, { recursive: true, force: true }); return true; }
    catch(e) { throw new Error(`fs.deleteDir: ${e.message}`); }
  },

  // ── Move / Copy ───────────────────────────────────────────────────
  rename(from, to) {
    try { _fs.renameSync(from, to); return true; }
    catch(e) { throw new Error(`fs.rename: ${e.message}`); }
  },

  copyFile(from, to) {
    try { _fs.copyFileSync(from, to); return true; }
    catch(e) { throw new Error(`fs.copyFile: ${e.message}`); }
  },

  // ── Path helpers ──────────────────────────────────────────────────
  join:     (...parts)   => _path.join(...parts),
  dirname:  (p)          => _path.dirname(p),
  basename: (p, ext)     => _path.basename(p, ext),
  ext:      (p)          => _path.extname(p),
  resolve:  (...parts)   => _path.resolve(...parts),
  cwd:      ()           => process.cwd(),
};
