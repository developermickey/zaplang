import * as readline from "readline"
import * as vm from "vm"
import { lex } from "./lexer"
import { Parser } from "./parser"
import { transpile } from "./transpiler"

const VERSION = "1.1.0"

const BANNER = `
  ⚡ Zap REPL v${VERSION}
  Type Zap code and press Enter.
  .help   Show commands   .exit   Quit
`

const COMMANDS: Record<string, string> = {
  ".exit": "Exit the REPL",
  ".quit": "Exit the REPL",
  ".clear": "Clear the screen",
  ".help": "Show this help",
  ".reset": "Reset the session context",
}

/** Count net open braces/brackets to detect incomplete input */
function netDepth(src: string): number {
  let depth = 0
  let inStr = false
  let strChar = ""
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      if (c === strChar && src[i - 1] !== "\\") inStr = false
      continue
    }
    if (c === '"' || c === "'" || c === "`") { inStr = true; strChar = c; continue }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue }
    if (c === "{" || c === "(" || c === "[") depth++
    if (c === "}" || c === ")" || c === "]") depth--
  }
  return depth
}

function zapToJS(source: string): string {
  const tokens = lex(source)
  const parser = new Parser(tokens)
  const ast = parser.parse()
  return transpile(ast)
}

/** Extract the stdlib preamble by transpiling an empty program */
const PREAMBLE_JS = (() => {
  const full = zapToJS("")
  // preamble is everything except "use strict" and the user code (nothing)
  return full.replace(/^"use strict";\n/, "").replace(/\blet\b/g, "var").replace(/\bconst\b/g, "var")
})()

/** Strip preamble + "use strict" from transpiled output, leaving only user code */
function userJS(zapSrc: string): string {
  const full = zapToJS(zapSrc)
  // Remove "use strict"; header
  let js = full.replace(/^"use strict";\n/, "")
  // Remove the preamble lines (everything before the actual user code)
  // The preamble always ends at the same length
  const preambleLines = PREAMBLE_JS.trimEnd().split("\n").length
  const lines = js.split("\n")
  const userLines = lines.slice(preambleLines)
  js = userLines.join("\n")
  // Replace let/const with var so declarations persist in vm context
  js = js.replace(/\blet\b/g, "var").replace(/\bconst\b/g, "var")
  return js.trim()
}

// JS runtime helpers injected into the vm context
const RUNTIME_PREAMBLE = `
const print = (...a) => console.log(...a)
const len   = (x) => Array.isArray(x) ? x.length : String(x).length
const range = (a, b) => { const r = []; for (let i = a; i < b; i++) r.push(i); return r }
const str   = (x) => String(x)
const num   = (x) => Number(x)
const bool  = (x) => Boolean(x)
const input = () => { throw new Error("input() is not available in REPL") }
`

export async function startRepl() {
  console.log(BANNER)

  // vm context — persists across inputs
  const ctx: Record<string, unknown> = { console, process, setTimeout, clearTimeout, setInterval, clearInterval }
  vm.createContext(ctx)
  vm.runInContext(RUNTIME_PREAMBLE, ctx)

  const isInteractive = process.stdin.isTTY
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: isInteractive,
    prompt: "zap> ",
  })

  let buffer = ""   // accumulates multi-line input
  let depth = 0

  rl.prompt()

  rl.on("line", (rawLine: string) => {
    const line = rawLine

    // Dot commands (only at top level, not inside a block)
    if (buffer === "" && line.trim().startsWith(".")) {
      const cmd = line.trim()
      if (cmd === ".exit" || cmd === ".quit") { console.log("Bye! ⚡"); process.exit(0) }
      if (cmd === ".clear") { process.stdout.write("\x1Bc"); rl.prompt(); return }
      if (cmd === ".reset") {
        // re-create context
        Object.keys(ctx).forEach(k => delete ctx[k])
        Object.assign(ctx, { console, process, setTimeout, clearTimeout, setInterval, clearInterval })
        vm.runInContext(RUNTIME_PREAMBLE, ctx)
        console.log("Context reset.")
        rl.prompt(); return
      }
      if (cmd === ".help") {
        for (const [c, d] of Object.entries(COMMANDS)) console.log(`  ${c.padEnd(10)} ${d}`)
        rl.prompt(); return
      }
      console.log(`Unknown command: ${cmd}. Type .help for commands.`)
      rl.prompt(); return
    }

    buffer += (buffer ? "\n" : "") + line
    depth = netDepth(buffer)

    if (depth > 0) {
      // incomplete — show continuation prompt
      rl.setPrompt("...  ")
      rl.prompt()
      return
    }

    // We have a complete expression/statement
    rl.setPrompt("zap> ")
    const source = buffer.trim()
    buffer = ""

    if (!source) { rl.prompt(); return }

    try {
      const js = userJS(source)
      vm.runInContext(js, ctx, { timeout: 5000 })
      // For simple expressions, show the value
      tryPrintValue(source, ctx)
    } catch (err: any) {
      console.error(`Error: ${err.message}`)
    }

    rl.prompt()
  })

  rl.on("close", () => { console.log("\nBye! ⚡"); process.exit(0) })
}

/** Try to print the value of the last expression if source is a simple expr */
function tryPrintValue(source: string, ctx: vm.Context) {
  const trimmed = source.trim()
  if (trimmed.includes("\n")) return
  if (/^(let|fn|if|while|loop|try|import|export|server|print)\b/.test(trimmed)) return
  if (/[=(]/.test(trimmed)) return  // assignments/calls have side effects

  // Bare identifier — look up directly in context
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    const val = (ctx as any)[trimmed]
    if (val !== undefined) {
      process.stdout.write(`\x1b[2m=> ${formatVal(val)}\x1b[0m\n`)
    }
    return
  }

  // Simple arithmetic / literals — try running via vm directly
  try {
    const val = vm.runInContext(trimmed, ctx, { timeout: 500 })
    if (val !== undefined && val !== null) {
      process.stdout.write(`\x1b[2m=> ${formatVal(val)}\x1b[0m\n`)
    }
  } catch {
    // not a valid expression in this context
  }
}

function formatVal(val: unknown): string {
  if (typeof val === "string") return JSON.stringify(val)
  if (Array.isArray(val)) return `[${val.map(formatVal).join(", ")}]`
  if (val !== null && typeof val === "object") return JSON.stringify(val, null, 2)
  return String(val)
}
