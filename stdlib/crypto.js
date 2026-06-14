"use strict";
/**
 * Zap Standard Library — crypto
 * import crypto from "zap:crypto"
 */
const _crypto = require("crypto");

module.exports = {
  // ── UUID ──────────────────────────────────────────────────────────
  uuid:    () => _crypto.randomUUID(),

  // ── Random ────────────────────────────────────────────────────────
  randomBytes:  (n = 16)  => _crypto.randomBytes(n).toString("hex"),
  randomInt:    (min, max) => _crypto.randomInt(min, max),
  randomToken:  (n = 32)  => _crypto.randomBytes(n).toString("base64url"),

  // ── Hashing ───────────────────────────────────────────────────────
  md5:    (str) => _crypto.createHash("md5").update(str).digest("hex"),
  sha1:   (str) => _crypto.createHash("sha1").update(str).digest("hex"),
  sha256: (str) => _crypto.createHash("sha256").update(str).digest("hex"),
  sha512: (str) => _crypto.createHash("sha512").update(str).digest("hex"),

  hash(str, algo = "sha256") {
    return _crypto.createHash(algo).update(str).digest("hex");
  },

  // ── HMAC ──────────────────────────────────────────────────────────
  hmac(str, secret, algo = "sha256") {
    return _crypto.createHmac(algo, secret).update(str).digest("hex");
  },

  // ── Encoding ──────────────────────────────────────────────────────
  base64Encode:  (str) => Buffer.from(str).toString("base64"),
  base64Decode:  (str) => Buffer.from(str, "base64").toString("utf-8"),
  hexEncode:     (str) => Buffer.from(str).toString("hex"),
  hexDecode:     (str) => Buffer.from(str, "hex").toString("utf-8"),

  // ── Password-safe compare ─────────────────────────────────────────
  safeEqual: (a, b) => {
    try { return _crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
    catch { return false; }
  },
};
