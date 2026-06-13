import { Node, Route } from "./parser"

// Transpile an expression (no semicolon, no indent)
function expr(node: Node): string {
  switch (node.kind) {
    case "Number": return String(node.value)
    case "String": return JSON.stringify(node.value)
    case "Bool":   return String(node.value)
    case "Ident":  return node.name

    case "BinOp":
      return `(${expr(node.left)} ${node.op} ${expr(node.right)})`

    case "UnaryOp":
      return `${node.op}${expr(node.expr)}`

    case "Call": {
      const callee = expr(node.callee)
      const args = node.args.map(expr).join(", ")
      // Built-in: print -> console.log
      if (callee === "print") return `console.log(${args})`
      // Built-in: input -> require("readline-sync").question()
      if (callee === "input") return `require("readline-sync").question(${args})`
      // Built-in: toNumber -> Number()
      if (callee === "toNumber") return `Number(${args})`
      // Built-in: toString -> String()
      if (callee === "toString") return `String(${args})`
      // Built-in: json -> JSON.stringify()
      if (callee === "json") return `JSON.stringify(${args})`
      // Built-in: parse -> JSON.parse()
      if (callee === "parse") return `JSON.parse(${args})`
      // Built-in: len -> .length
      if (callee === "len") return `(${args}).length`
      // Built-in: type -> typeof
      if (callee === "type") return `typeof ${args}`
      return `${callee}(${args})`
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

// Transpile a statement (has indent + semicolon where needed)
function stmt(node: Node, indent: number): string {
  const pad = "  ".repeat(indent)

  switch (node.kind) {
    case "VarDecl":
      return `${pad}let ${node.name} = ${expr(node.value)};`

    case "Assign":
      return `${pad}${node.name} = ${expr(node.value)};`

    case "FnDecl": {
      const params = node.params.join(", ")
      const body = node.body.map(n => stmt(n, indent + 1)).join("\n")
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

    case "Loop":
      return [
        `${pad}for (let ${node.var} = ${expr(node.from)}; ${node.var} < ${expr(node.to)}; ${node.var}++) {`,
        node.body.map(n => stmt(n, indent + 1)).join("\n"),
        `${pad}}`
      ].join("\n")

    case "Return":
      return `${pad}return${node.value ? " " + expr(node.value) : ""};`

    case "Call":
    case "BinOp":
    case "UnaryOp":
    case "Member":
    case "Index":
      return `${pad}${expr(node)};`

    case "Server":
      return transpileServer(node, indent)

    default:
      return ""
  }
}

function transpileServer(node: Node & { kind: "Server" }, indent: number): string {
  const pad = "  ".repeat(indent)
  const port = expr(node.port)

  const lines: string[] = [
    `${pad}const __http__ = require("http");`,
    `${pad}const __url__  = require("url");`,
    "",
  ]

  // Emit one named function per route
  for (const route of node.routes) {
    const safeName = routeFnName(route)
    const params = route.handler.params.length > 0
      ? route.handler.params.join(", ")
      : "req, res"
    const body = route.handler.body.map(n => stmt(n, indent + 1)).join("\n")
    lines.push(`${pad}async function ${safeName}(${params}) {`)
    lines.push(body)
    lines.push(`${pad}}`)
    lines.push("")
  }

  // HTTP server
  lines.push(`${pad}const __server__ = __http__.createServer(async (req, res) => {`)
  lines.push(`${pad}  const __parsed__ = __url__.parse(req.url, true);`)
  lines.push(`${pad}  const __path__   = __parsed__.pathname;`)
  lines.push(`${pad}  let __body__     = "";`)
  lines.push(`${pad}  req.on("data", chunk => { __body__ += chunk; });`)
  lines.push(`${pad}  req.on("end", async () => {`)
  lines.push(`${pad}    try { req.body = JSON.parse(__body__); } catch(e) { req.body = __body__; }`)
  lines.push(`${pad}    req.query = __parsed__.query;`)

  for (const route of node.routes) {
    const safeName = routeFnName(route)
    const hasResParam = route.handler.params.length >= 2
    lines.push(`${pad}    if (req.method === "${route.method}" && __path__ === "${route.path}") {`)
    lines.push(`${pad}      const __result__ = await ${safeName}(req${hasResParam ? ", res" : ""});`)
    lines.push(`${pad}      if (__result__ !== undefined && !res.headersSent) {`)
    lines.push(`${pad}        if (typeof __result__ === "object") {`)
    lines.push(`${pad}          res.writeHead(200, { "Content-Type": "application/json" });`)
    lines.push(`${pad}          res.end(JSON.stringify(__result__));`)
    lines.push(`${pad}        } else {`)
    lines.push(`${pad}          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });`)
    lines.push(`${pad}          res.end(String(__result__));`)
    lines.push(`${pad}        }`)
    lines.push(`${pad}      }`)
    lines.push(`${pad}      return;`)
    lines.push(`${pad}    }`)
  }

  lines.push(`${pad}    res.writeHead(404, { "Content-Type": "text/plain" });`)
  lines.push(`${pad}    res.end("404 Not Found");`)
  lines.push(`${pad}  });`)
  lines.push(`${pad}});`)
  lines.push("")
  lines.push(`${pad}__server__.listen(${port}, () => {`)
  lines.push(`${pad}  console.log("[Zap] Server running on http://localhost:" + ${port});`)
  lines.push(`${pad}});`)

  return lines.join("\n")
}

function routeFnName(route: Route): string {
  const safePath = route.path.replace(/[^a-zA-Z0-9]/g, "_") || "_root_"
  return `__route_${route.method}_${safePath}__`
}

export function transpile(program: Node): string {
  if (program.kind !== "Program") throw new Error("Expected Program node")
  const header = `"use strict";\n`
  const body = program.body.map(n => stmt(n, 0)).join("\n")
  return header + body + "\n"
}
