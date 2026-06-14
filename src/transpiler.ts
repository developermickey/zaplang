import { Node, Route } from "./parser"

// ── Built-in function map ────────────────────────────────────────────
const BUILTINS: Record<string, (...a: string[]) => string> = {
  print:     (...a) => `console.log(${a.join(", ")})`,
  println:   (...a) => `console.log(${a.join(", ")})`,
  input:     (...a) => `require("readline-sync").question(${a.join(", ")})`,
  toNumber:  (...a) => `Number(${a[0]})`,
  toInt:     (...a) => `Math.floor(Number(${a[0]}))`,
  toStr:     (...a) => `String(${a[0]})`,
  toBool:    (...a) => `Boolean(${a[0]})`,
  json:      (...a) => `JSON.stringify(${a[0]}, null, 2)`,
  parse:     (...a) => `JSON.parse(${a[0]})`,
  len:       (...a) => `(${a[0]}).length`,
  type:      (...a) => `typeof ${a[0]}`,
  keys:      (...a) => `Object.keys(${a[0]})`,
  values:    (...a) => `Object.values(${a[0]})`,
  entries:   (...a) => `Object.entries(${a[0]})`,
  range:     (...a) => `Array.from({length: ${a[1] ?? a[0]}}, (_, i) => i + ${a[1] ? a[0] : 0})`,
  push:      (...a) => `${a[0]}.push(${a.slice(1).join(", ")})`,
  pop:       (...a) => `${a[0]}.pop()`,
  shift:     (...a) => `${a[0]}.shift()`,
  unshift:   (...a) => `${a[0]}.unshift(${a.slice(1).join(", ")})`,
  join:      (...a) => `${a[0]}.join(${a[1] ?? '""'})`,
  split:     (...a) => `${a[0]}.split(${a[1] ?? '""'})`,
  includes:  (...a) => `${a[0]}.includes(${a[1]})`,
  indexOf:   (...a) => `${a[0]}.indexOf(${a[1]})`,
  slice:     (...a) => `${a[0]}.slice(${a.slice(1).join(", ")})`,
  reverse:   (...a) => `[...${a[0]}].reverse()`,
  sort:      (...a) => `[...${a[0]}].sort()`,
  flat:      (...a) => `${a[0]}.flat(${a[1] ?? ""})`,
  map:       (...a) => `${a[0]}.map(${a[1]})`,
  filter:    (...a) => `${a[0]}.filter(${a[1]})`,
  reduce:    (...a) => `${a[0]}.reduce(${a[1]}, ${a[2]})`,
  find:      (...a) => `${a[0]}.find(${a[1]})`,
  every:     (...a) => `${a[0]}.every(${a[1]})`,
  some:      (...a) => `${a[0]}.some(${a[1]})`,
  upper:     (...a) => `(${a[0]}).toUpperCase()`,
  lower:     (...a) => `(${a[0]}).toLowerCase()`,
  trim:      (...a) => `(${a[0]}).trim()`,
  replace:   (...a) => `(${a[0]}).replace(${a[1]}, ${a[2]})`,
  startsWith:(...a) => `(${a[0]}).startsWith(${a[1]})`,
  endsWith:  (...a) => `(${a[0]}).endsWith(${a[1]})`,
  repeat:    (...a) => `(${a[0]}).repeat(${a[1]})`,
  padStart:  (...a) => `(${a[0]}).padStart(${a[1]}, ${a[2] ?? '" "'})`,
  abs:       (...a) => `Math.abs(${a[0]})`,
  ceil:      (...a) => `Math.ceil(${a[0]})`,
  floor:     (...a) => `Math.floor(${a[0]})`,
  round:     (...a) => `Math.round(${a[0]})`,
  sqrt:      (...a) => `Math.sqrt(${a[0]})`,
  pow:       (...a) => `Math.pow(${a[0]}, ${a[1]})`,
  min:       (...a) => `Math.min(${a.join(", ")})`,
  max:       (...a) => `Math.max(${a.join(", ")})`,
  random:    ()     => `Math.random()`,
  randomInt: (...a) => `Math.floor(Math.random() * (${a[1] ?? a[0]}) + ${a[1] ? a[0] : 0})`,
  now:       ()     => `Date.now()`,
  date:      ()     => `new Date().toISOString()`,
  sleep:     (...a) => `await new Promise(r => setTimeout(r, ${a[0]}))`,
  exit:      (...a) => `process.exit(${a[0] ?? 0})`,
  env:       (...a) => `process.env[${a[0]}]`,
  error:     (...a) => `(new Error(${a[0]}))`,
  throw:     (...a) => `(() => { throw new Error(${a[0]}); })()`,
}

// ── Template string transpiler `Hello {name}` ───────────────────────
function transpileTemplate(raw: string): string {
  // Convert {expr} to ${expr}
  const converted = raw.replace(/\{([^}]+)\}/g, "${$1}")
  return "`" + converted + "`"
}

// ── Expression (no semicolon, no indent) ────────────────────────────
function expr(node: Node): string {
  switch (node.kind) {
    case "Number":   return String(node.value)
    case "String":   return JSON.stringify(node.value)
    case "Template": return transpileTemplate(node.value)
    case "Bool":     return String(node.value)
    case "Null":     return "null"
    case "Ident":    return node.name

    case "BinOp":
      return `(${expr(node.left)} ${node.op} ${expr(node.right)})`

    case "UnaryOp":
      return `${node.op}${expr(node.expr)}`

    case "PostfixOp":
      return `${expr(node.expr)}${node.op}`

    case "Ternary":
      return `(${expr(node.cond)} ? ${expr(node.then)} : ${expr(node.else)})`

    case "Call": {
      const callee = expr(node.callee)
      const args = node.args.map(expr)
      // Check built-ins
      if (BUILTINS[callee]) return BUILTINS[callee](...args)
      return `${callee}(${args.join(", ")})`
    }

    case "Member":
      return `${expr(node.object)}.${node.prop}`

    case "Index":
      return `${expr(node.object)}[${expr(node.index)}]`

    case "Array":
      return `[${node.elements.map(expr).join(", ")}]`

    case "Object":
      return `{ ${node.pairs.map(p => `${p.key}: ${expr(p.value)}`).join(", ")} }`

    case "AnonFn": {
      const params = node.params.join(", ")
      const body = node.body.map(n => stmt(n, 1)).join("\n")
      return `function(${params}) {\n${body}\n}`
    }

    default:
      return ""
  }
}

// ── Statement (indent + semicolons) ─────────────────────────────────
function stmt(node: Node, indent: number): string {
  const pad = "  ".repeat(indent)

  switch (node.kind) {
    case "VarDecl":
      return `${pad}let ${node.name} = ${expr(node.value)};`

    case "Assign": {
      const target = expr(node.target)
      if (node.op === "=") return `${pad}${target} = ${expr(node.value)};`
      return `${pad}${target} ${node.op} ${expr(node.value)};`
    }

    case "FnDecl": {
      const params = node.params.join(", ")
      const body = node.body.map(n => stmt(n, indent + 1)).join("\n")
      const prefix = node.exported ? "module.exports." : ""
      if (node.exported) {
        return `${pad}${prefix}${node.name} = function ${node.name}(${params}) {\n${body}\n${pad}};`
      }
      return `${pad}function ${node.name}(${params}) {\n${body}\n${pad}}`
    }

    case "If": {
      let out = `${pad}if (${expr(node.cond)}) {\n`
      out += node.then.map(n => stmt(n, indent + 1)).join("\n")
      out += `\n${pad}}`
      for (const ei of node.elif) {
        out += ` else if (${expr(ei.cond)}) {\n`
        out += ei.body.map(n => stmt(n, indent + 1)).join("\n")
        out += `\n${pad}}`
      }
      if (node.else.length > 0) {
        out += ` else {\n`
        out += node.else.map(n => stmt(n, indent + 1)).join("\n")
        out += `\n${pad}}`
      }
      return out
    }

    case "While":
      return [
        `${pad}while (${expr(node.cond)}) {`,
        node.body.map(n => stmt(n, indent + 1)).join("\n"),
        `${pad}}`
      ].join("\n")

    case "Loop": {
      const step = node.step ? expr(node.step) : "1"
      return [
        `${pad}for (let ${node.var} = ${expr(node.from)}; ${node.var} < ${expr(node.to)}; ${node.var} += ${step}) {`,
        node.body.map(n => stmt(n, indent + 1)).join("\n"),
        `${pad}}`
      ].join("\n")
    }

    case "Return":
      return `${pad}return${node.value ? " " + expr(node.value) : ""};`

    case "Break":    return `${pad}break;`
    case "Continue": return `${pad}continue;`

    case "Try": {
      let out = `${pad}try {\n`
      out += node.body.map(n => stmt(n, indent + 1)).join("\n")
      out += `\n${pad}}`
      if (node.catch.length > 0) {
        const catchParam = node.catchVar ?? "__err__"
        out += ` catch(${catchParam}) {\n`
        out += node.catch.map(n => stmt(n, indent + 1)).join("\n")
        out += `\n${pad}}`
      }
      if (node.finally.length > 0) {
        out += ` finally {\n`
        out += node.finally.map(n => stmt(n, indent + 1)).join("\n")
        out += `\n${pad}}`
      }
      return out
    }

    case "Import": {
      if (node.names.length > 0) {
        return `${pad}const { ${node.names.join(", ")} } = require(${JSON.stringify(node.path)});`
      }
      if (node.alias) {
        return `${pad}const ${node.alias} = require(${JSON.stringify(node.path)});`
      }
      return `${pad}require(${JSON.stringify(node.path)});`
    }

    case "Server":
      return transpileServer(node, indent)

    case "Call":
    case "BinOp":
    case "UnaryOp":
    case "PostfixOp":
    case "Member":
    case "Index":
    case "Ternary":
    case "Assign":
      return `${pad}${expr(node)};`

    default:
      return ""
  }
}

// ── Server transpiler ────────────────────────────────────────────────
function transpileServer(node: Node & { kind: "Server" }, indent: number): string {
  const pad = "  ".repeat(indent)
  const port = expr(node.port)

  const lines: string[] = [
    `${pad}const __http__ = require("http");`,
    `${pad}const __url__  = require("url");`,
    "",
  ]

  for (const route of node.routes) {
    const safeName = routeFnName(route)
    const params = route.handler.params.length > 0 ? route.handler.params.join(", ") : "req, res"
    const body = route.handler.body.map(n => stmt(n, indent + 1)).join("\n")
    lines.push(`${pad}async function ${safeName}(${params}) {`)
    lines.push(body || `${pad}  // empty handler`)
    lines.push(`${pad}}`)
    lines.push("")
  }

  lines.push(`${pad}const __server__ = __http__.createServer(async (req, res) => {`)
  lines.push(`${pad}  const __parsed__ = __url__.parse(req.url || "/", true);`)
  lines.push(`${pad}  const __path__   = __parsed__.pathname;`)
  lines.push(`${pad}  let __body__     = "";`)
  lines.push(`${pad}  req.on("data", chunk => { __body__ += chunk; });`)
  lines.push(`${pad}  req.on("end", async () => {`)
  lines.push(`${pad}    try { req.body = JSON.parse(__body__); } catch(e) { req.body = __body__; }`)
  lines.push(`${pad}    req.query  = __parsed__.query;`)
  lines.push(`${pad}    req.params = {};`)

  for (const route of node.routes) {
    const safeName = routeFnName(route)
    const hasResParam = route.handler.params.length >= 2
    lines.push(`${pad}    if (req.method === "${route.method}" && __path__ === "${route.path}") {`)
    lines.push(`${pad}      try {`)
    lines.push(`${pad}        const __result__ = await ${safeName}(req${hasResParam ? ", res" : ""});`)
    lines.push(`${pad}        if (__result__ !== undefined && !res.headersSent) {`)
    lines.push(`${pad}          if (typeof __result__ === "object") {`)
    lines.push(`${pad}            res.writeHead(200, { "Content-Type": "application/json" });`)
    lines.push(`${pad}            res.end(JSON.stringify(__result__));`)
    lines.push(`${pad}          } else {`)
    lines.push(`${pad}            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });`)
    lines.push(`${pad}            res.end(String(__result__));`)
    lines.push(`${pad}          }`)
    lines.push(`${pad}        }`)
    lines.push(`${pad}      } catch(__e__) {`)
    lines.push(`${pad}        res.writeHead(500, { "Content-Type": "application/json" });`)
    lines.push(`${pad}        res.end(JSON.stringify({ error: __e__.message }));`)
    lines.push(`${pad}      }`)
    lines.push(`${pad}      return;`)
    lines.push(`${pad}    }`)
  }

  lines.push(`${pad}    res.writeHead(404, { "Content-Type": "application/json" });`)
  lines.push(`${pad}    res.end(JSON.stringify({ error: "Not Found", path: __path__ }));`)
  lines.push(`${pad}  });`)
  lines.push(`${pad}});`)
  lines.push(`${pad}__server__.on("error", (e) => console.error("[Zap] Server error:", e.message));`)
  lines.push("")
  lines.push(`${pad}__server__.listen(${port}, () => {`)
  lines.push(`${pad}  console.log("[Zap] ⚡ Server running on http://localhost:" + ${port});`)
  lines.push(`${pad}});`)

  return lines.join("\n")
}

function routeFnName(route: Route): string {
  const safePath = route.path.replace(/[^a-zA-Z0-9]/g, "_") || "_root_"
  return `__route_${route.method}_${safePath}__`
}

const STDLIB = `
const sqrt      = (x) => Math.sqrt(x);
const abs       = (x) => Math.abs(x);
const ceil      = (x) => Math.ceil(x);
const floor     = (x) => Math.floor(x);
const round     = (x) => Math.round(x);
const pow       = (x, y) => Math.pow(x, y);
const min       = (...a) => Math.min(...a);
const max       = (...a) => Math.max(...a);
const random    = () => Math.random();
const randomInt = (a, b) => Math.floor(Math.random() * (b - a)) + a;
const now       = () => Date.now();
const date      = () => new Date().toISOString();
const sleep     = (ms) => new Promise(r => setTimeout(r, ms));
const exit      = (c) => process.exit(c ?? 0);
const env       = (k) => process.env[k];
const len       = (x) => (x == null ? 0 : x.length);
const keys      = (x) => Object.keys(x);
const values    = (x) => Object.values(x);
const entries   = (x) => Object.entries(x);
const range     = (a, b) => b !== undefined ? Array.from({length: b - a}, (_, i) => i + a) : Array.from({length: a}, (_, i) => i);
const push      = (arr, ...v) => arr.push(...v);
const pop       = (arr) => arr.pop();
const shift     = (arr) => arr.shift();
const unshift   = (arr, ...v) => arr.unshift(...v);
const join      = (arr, sep = ",") => arr.join(sep);
const split     = (str, sep = "") => str.split(sep);
const includes  = (x, v) => x.includes(v);
const indexOf   = (x, v) => x.indexOf(v);
const slice     = (x, a, b) => x.slice(a, b);
const reverse   = (arr) => [...arr].reverse();
const sort      = (arr, fn) => [...arr].sort(fn);
const flat      = (arr, d) => arr.flat(d);
const upper     = (s) => String(s).toUpperCase();
const lower     = (s) => String(s).toLowerCase();
const trim      = (s) => String(s).trim();
const replace   = (s, a, b) => String(s).replace(a, b);
const startsWith= (s, v) => String(s).startsWith(v);
const endsWith  = (s, v) => String(s).endsWith(v);
const repeat    = (s, n) => String(s).repeat(n);
const padStart  = (s, n, c = " ") => String(s).padStart(n, c);
const toNumber  = (x) => Number(x);
const toInt     = (x) => Math.floor(Number(x));
const toStr     = (x) => String(x);
const toBool    = (x) => Boolean(x);
const type      = (x) => typeof x;
const json      = (x) => JSON.stringify(x, null, 2);
const parse     = (x) => JSON.parse(x);
const map       = (arr, fn) => arr.map(fn);
const filter    = (arr, fn) => arr.filter(fn);
const reduce    = (arr, fn, init) => arr.reduce(fn, init);
const find      = (arr, fn) => arr.find(fn);
const every     = (arr, fn) => arr.every(fn);
const some      = (arr, fn) => arr.some(fn);
`.trim()

export function transpile(program: Node): string {
  if (program.kind !== "Program") throw new Error("Expected Program node")
  const header = `"use strict";\n${STDLIB}\n`
  const body = program.body.map(n => stmt(n, 0)).join("\n")
  return header + body + "\n"
}
