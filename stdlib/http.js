"use strict";
/**
 * Zap Standard Library — http (HTTP client)
 * import http from "zap:http"
 */
const https = require("https");
const hhttp = require("http");
const url   = require("url");

function request(method, urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : hhttp;

    const body = options.body
      ? (typeof options.body === "object" ? JSON.stringify(options.body) : String(options.body))
      : null;

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Zap/2.0",
      ...(options.headers || {}),
      ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
    };

    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers,
    }, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        const ct = res.headers["content-type"] || "";
        let body;
        try { body = ct.includes("json") ? JSON.parse(data) : data; }
        catch { body = data; }
        resolve({ status: res.statusCode, headers: res.headers, body, ok: res.statusCode < 400 });
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  get:    (url, opts = {})       => request("GET",    url, opts),
  post:   (url, body, opts = {}) => request("POST",   url, { ...opts, body }),
  put:    (url, body, opts = {}) => request("PUT",    url, { ...opts, body }),
  patch:  (url, body, opts = {}) => request("PATCH",  url, { ...opts, body }),
  delete: (url, opts = {})       => request("DELETE", url, opts),
  fetch:  (url, opts = {})       => request(opts.method || "GET", url, opts),

  // ── URL helpers ───────────────────────────────────────────────────
  parseUrl:  (u)       => new URL(u),
  buildUrl:  (base, params) => {
    const u = new URL(base);
    Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v));
    return u.toString();
  },
  encodeQuery: (params) =>
    Object.entries(params).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&"),
};
