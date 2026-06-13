#!/usr/bin/env node

import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"
import { lex } from "./lexer"
import { Parser } from "./parser"
import { transpile } from "./transpiler"

const args = process.argv.slice(2)
const command = args[0]
const filePath = args[1]

function compile(source: string): string {
  const tokens = lex(source)
  const parser = new Parser(tokens)
  const ast = parser.parse()
  return transpile(ast)
}

function run(file: string) {
  const source = fs.readFileSync(file, "utf-8")
  const js = compile(source)
  const tmpFile = path.join(path.dirname(path.resolve(file)), ".zp_tmp.js")
  fs.writeFileSync(tmpFile, js)
  try {
    execSync(`node "${tmpFile}"`, { stdio: "inherit" })
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  }
}

function build(file: string) {
  const source = fs.readFileSync(file, "utf-8")
  const js = compile(source)
  const outFile = file.replace(/\.(zap|zp)$/, ".js")
  fs.writeFileSync(outFile, js)
  console.log(`[Zap] Built: ${outFile}`)
}

function showHelp() {
  console.log(`
  ⚡ Zap Language v1.0.0
  Simple · Fast · Full-Stack

  Usage:
    zap run   <file.zap>     Run a Zap file
    zap build <file.zap>     Compile to JavaScript
    zap help                 Show this help

  Example:
    zap run hello.zap        (.zap extension)
    zap run hello.zp         (.zp extension works too!)
    zap run server.zp
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
  case "help":
  default:
    showHelp()
}
