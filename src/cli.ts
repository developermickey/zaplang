#!/usr/bin/env node

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { execSync, spawnSync } from "child_process"
import { lex } from "./lexer"
import { Parser } from "./parser"
import { transpile } from "./transpiler"
import { generateC } from "./codegen_c"
import { format } from "./formatter"
import { startRepl } from "./repl"

const args = process.argv.slice(2)
const command = args[0]
const filePath = args[1]
const flags = args.slice(2)

function getAST(source: string) {
  const tokens = lex(source)
  const parser = new Parser(tokens)
  return parser.parse()
}

function compileJS(source: string): string {
  return transpile(getAST(source))
}

function compileC(source: string): string {
  return generateC(getAST(source))
}

// ── zap run <file.zp> ────────────────────────────────────────────────
function run(file: string) {
  const source = fs.readFileSync(file, "utf-8")
  const js = compileJS(source)
  const tmpFile = path.join(os.tmpdir(), `.zp_run_${Date.now()}.js`)
  fs.writeFileSync(tmpFile, js)
  try {
    execSync(`node "${tmpFile}"`, { stdio: "inherit" })
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  }
}

// ── zap build <file.zp> [--native] [-o output] ───────────────────────
function build(file: string) {
  const source = fs.readFileSync(file, "utf-8")
  const isNative = flags.includes("--native") || flags.includes("-n")
  const outputIdx = flags.indexOf("-o")
  const outputOverride = outputIdx !== -1 ? flags[outputIdx + 1] : null

  if (isNative) {
    buildNative(file, source, outputOverride)
  } else {
    buildJS(file, source, outputOverride)
  }
}

function buildJS(file: string, source: string, outOverride: string | null) {
  const js = compileJS(source)
  const outFile = outOverride ?? file.replace(/\.(zap|zp)$/, ".js")
  fs.writeFileSync(outFile, js)
  console.log(`[Zap] ✅ Built JS: ${outFile}`)
  console.log(`[Zap]    Run with: node ${outFile}`)
}

function buildNative(file: string, source: string, outOverride: string | null) {
  const c = compileC(source)
  const baseName = path.basename(file).replace(/\.(zap|zp)$/, "")
  const outDir = path.dirname(path.resolve(file))
  const cFile = path.join(os.tmpdir(), `${baseName}_${Date.now()}.c`)
  const outFile = outOverride ?? path.join(outDir, baseName)

  fs.writeFileSync(cFile, c)
  console.log(`[Zap] Compiling to native binary...`)

  // Try clang first, then gcc
  const compiler = findCompiler()
  if (!compiler) {
    console.error("[Zap] ❌ No C compiler found. Install clang or gcc.")
    process.exit(1)
  }

  const result = spawnSync(compiler, [
    cFile, "-o", outFile,
    "-O2",          // optimize
    "-lm",          // link math
    "-std=c99",
    "-Wall",
    "-Wno-unused-variable",
  ], { encoding: "utf-8" })

  if (fs.existsSync(cFile)) fs.unlinkSync(cFile)

  if (result.status !== 0) {
    console.error(`[Zap] ❌ Compile error:\n${result.stderr}`)
    process.exit(1)
  }

  const size = (fs.statSync(outFile).size / 1024).toFixed(1)
  console.log(`[Zap] ✅ Native binary: ${outFile}  (${size} KB)`)
  console.log(`[Zap]    Run with: ${outFile}`)
}

function findCompiler(): string | null {
  for (const cc of ["clang", "gcc", "cc"]) {
    try { execSync(`which ${cc}`, { stdio: "pipe" }); return cc } catch {}
  }
  return null
}

// ── zap emit-c <file.zp> ─────────────────────────────────────────────
function emitC(file: string) {
  const source = fs.readFileSync(file, "utf-8")
  const c = compileC(source)
  const outFile = file.replace(/\.(zap|zp)$/, ".c")
  fs.writeFileSync(outFile, c)
  console.log(`[Zap] ✅ C source: ${outFile}`)
}

// ── zap fmt <file.zp> [--check] ──────────────────────────────────────
function fmt(file: string) {
  const check = flags.includes("--check")

  // fmt on a directory — format all .zap/.zp files recursively
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    const files = findZapFiles(file)
    let changed = 0
    for (const f of files) {
      const result = fmtFile(f, check)
      if (result) changed++
    }
    if (check) {
      if (changed > 0) {
        console.log(`[Zap] ❌ ${changed} file(s) need formatting. Run: zap fmt <dir>`)
        process.exit(1)
      } else {
        console.log(`[Zap] ✅ All files are formatted.`)
      }
    } else {
      console.log(`[Zap] ✅ Formatted ${changed} file(s).`)
    }
    return
  }

  const changed = fmtFile(file, check)
  if (check) {
    if (changed) {
      console.log(`[Zap] ❌ ${path.basename(file)} needs formatting.`)
      process.exit(1)
    } else {
      console.log(`[Zap] ✅ ${path.basename(file)} is already formatted.`)
    }
  } else {
    if (changed) console.log(`[Zap] ✅ Formatted: ${file}`)
    else         console.log(`[Zap] ✓  Already formatted: ${file}`)
  }
}

function fmtFile(file: string, checkOnly: boolean): boolean {
  const source = fs.readFileSync(file, "utf-8")
  let formatted: string
  try {
    formatted = format(source)
  } catch (e: any) {
    console.error(`[Zap] ⚠️  Could not format ${file}: ${e.message}`)
    return false
  }
  if (source === formatted) return false
  if (!checkOnly) fs.writeFileSync(file, formatted, "utf-8")
  return true
}

function findZapFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...findZapFiles(full))
    } else if (entry.isFile() && /\.(zap|zp)$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

// ── zap new <name> ───────────────────────────────────────────────────
function newProject(name: string) {
  if (!name) { console.error("[Zap] Usage: zap new <project-name>"); process.exit(1) }
  fs.mkdirSync(name, { recursive: true })
  fs.writeFileSync(`${name}/main.zp`, `// ${name} — built with Zap ⚡\n\nlet name = "${name}"\nprint(\`Hello from {name}!\`)\n`)
  console.log(`[Zap] ✅ Created project: ${name}/`)
  console.log(`[Zap]    Run with: zap run ${name}/main.zp`)
}

function showHelp() {
  console.log(`
  ⚡ Zap Language v1.1.0
  Simple · Fast · Full-Stack · Native

  Usage:
    zap run    <file.zp>                Run a Zap file (via JS)
    zap build  <file.zp>                Compile to JavaScript
    zap build  <file.zp> --native       Compile to native binary
    zap build  <file.zp> --native -o x  Set output binary name
    zap repl                            Start interactive REPL
    zap fmt    <file.zp>                Format a Zap file in-place
    zap fmt    <dir>                    Format all .zap/.zp files in dir
    zap fmt    <file.zp> --check        Check formatting without writing
    zap emit-c <file.zp>                Show generated C code
    zap new    <project-name>           Scaffold a new Zap project
    zap help                            Show this help

  Examples:
    zap run hello.zp
    zap build server.zp
    zap build hello.zp --native -o hello
    zap fmt .
    zap fmt main.zp --check

  File extensions:  .zap  or  .zp  (both work)
  npm: npm install -g zap-language
  `)
}

switch (command) {
  case "run":
    if (!filePath) { console.error("[Zap] Error: No file specified"); process.exit(1) }
    run(filePath)
    break
  case "build":
    if (!filePath) { console.error("[Zap] Error: No file specified"); process.exit(1) }
    build(filePath)
    break
  case "emit-c":
    if (!filePath) { console.error("[Zap] Error: No file specified"); process.exit(1) }
    emitC(filePath)
    break
  case "fmt":
    if (!filePath) { console.error("[Zap] Usage: zap fmt <file.zp|dir> [--check]"); process.exit(1) }
    fmt(filePath)
    break
  case "repl":
    startRepl()
    break
  case "new":
    newProject(filePath)
    break
  case "help":
  default:
    showHelp()
}
