"use strict";
/**
 * Zap Standard Library — os (Operating System)
 * import os from "zap:os"
 */
const _os = require("os");

module.exports = {
  platform:   () => process.platform,        // "darwin" | "linux" | "win32"
  arch:       () => process.arch,            // "x64" | "arm64"
  hostname:   () => _os.hostname(),
  homedir:    () => _os.homedir(),
  tmpdir:     () => _os.tmpdir(),
  cwd:        () => process.cwd(),
  username:   () => _os.userInfo().username,

  // Memory (in MB)
  totalMem:   () => Math.round(_os.totalmem()  / 1024 / 1024),
  freeMem:    () => Math.round(_os.freemem()   / 1024 / 1024),
  usedMem:    () => Math.round((_os.totalmem() - _os.freemem()) / 1024 / 1024),

  // CPU
  cpuCount:   () => _os.cpus().length,
  cpuModel:   () => _os.cpus()[0]?.model || "unknown",

  // Process
  pid:        () => process.pid,
  args:       () => process.argv.slice(2),
  env:        (key) => process.env[key],
  setEnv:     (key, val) => { process.env[key] = val; },

  // Uptime (seconds)
  uptime:     () => process.uptime(),

  exit:       (code = 0) => process.exit(code),

  // Run a shell command and return output
  exec(cmd) {
    try {
      return require("child_process").execSync(cmd, { encoding: "utf-8" }).trim();
    } catch(e) { throw new Error(`os.exec: ${e.message}`); }
  },

  // Run command and return { stdout, stderr, code }
  run(cmd) {
    const r = require("child_process").spawnSync(cmd, { shell: true, encoding: "utf-8" });
    return { stdout: r.stdout?.trim(), stderr: r.stderr?.trim(), code: r.status };
  },
};
