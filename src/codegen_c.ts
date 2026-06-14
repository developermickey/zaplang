/**
 * Zap → C code generator
 * Compiles Zap AST to C99 source, which is then compiled by clang/gcc
 * to a native binary.
 */

import { Node, Route } from "./parser"

// ── C runtime header (embedded) ──────────────────────────────────────
const C_RUNTIME = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
#include <time.h>
#include <stdint.h>

/* ── ZapString: heap-allocated string ── */
typedef struct { char *data; size_t len; } ZapString;

static ZapString zap_str(const char *s) {
  size_t n = strlen(s);
  ZapString z; z.data = (char*)malloc(n + 1);
  memcpy(z.data, s, n + 1); z.len = n;
  return z;
}

static ZapString zap_str_concat(ZapString a, ZapString b) {
  size_t n = a.len + b.len;
  ZapString z; z.data = (char*)malloc(n + 1);
  memcpy(z.data, a.data, a.len);
  memcpy(z.data + a.len, b.data, b.len);
  z.data[n] = '\\0'; z.len = n;
  return z;
}

static ZapString zap_num_to_str(double n) {
  char buf[64];
  if (n == (long long)n) snprintf(buf, sizeof(buf), "%lld", (long long)n);
  else snprintf(buf, sizeof(buf), "%g", n);
  return zap_str(buf);
}

static double zap_str_to_num(ZapString s) { return atof(s.data); }
static int    zap_str_eq(ZapString a, ZapString b) { return strcmp(a.data, b.data) == 0; }

static void zap_print_num(double n) {
  if (n == (long long)n) printf("%lld\\n", (long long)n);
  else printf("%g\\n", n);
}
static void zap_print_str(ZapString s) { printf("%s\\n", s.data); }
static void zap_print_bool(int b)      { printf("%s\\n", b ? "true" : "false"); }

/* ── Math builtins ── */
static double zap_abs(double x)       { return fabs(x); }
static double zap_sqrt(double x)      { return sqrt(x); }
static double zap_floor(double x)     { return floor(x); }
static double zap_ceil(double x)      { return ceil(x); }
static double zap_round(double x)     { return round(x); }
static double zap_pow(double x, double y) { return pow(x, y); }
static double zap_min(double a, double b) { return a < b ? a : b; }
static double zap_max(double a, double b) { return a > b ? a : b; }
static double zap_random(void) { return (double)rand() / RAND_MAX; }
static double zap_random_int(double lo, double hi) {
  return lo + (int)(zap_random() * (hi - lo));
}

/* ── String builtins ── */
static ZapString zap_upper(ZapString s) {
  ZapString r = zap_str(s.data);
  for (size_t i = 0; i < r.len; i++) r.data[i] = (char)toupper((unsigned char)r.data[i]);
  return r;
}
static ZapString zap_lower(ZapString s) {
  ZapString r = zap_str(s.data);
  for (size_t i = 0; i < r.len; i++) r.data[i] = (char)tolower((unsigned char)r.data[i]);
  return r;
}
static double zap_len_str(ZapString s) { return (double)s.len; }
static int zap_starts_with(ZapString s, ZapString prefix) {
  return s.len >= prefix.len && memcmp(s.data, prefix.data, prefix.len) == 0;
}
static int zap_ends_with(ZapString s, ZapString suffix) {
  return s.len >= suffix.len && memcmp(s.data + s.len - suffix.len, suffix.data, suffix.len) == 0;
}
`.trim()

// ── Type inference (simple) ──────────────────────────────────────────
type ZapType = "num" | "str" | "bool" | "void" | "unknown"

interface Env {
  vars: Map<string, ZapType>
  parent: Env | null
}

function newEnv(parent: Env | null = null): Env {
  return { vars: new Map(), parent }
}

function lookupType(env: Env, name: string): ZapType {
  if (env.vars.has(name)) return env.vars.get(name)!
  if (env.parent) return lookupType(env.parent, name)
  return "unknown"
}

function inferType(node: Node, env: Env): ZapType {
  switch (node.kind) {
    case "Number":  return "num"
    case "String":
    case "Template": return "str"
    case "Bool":    return "bool"
    case "Null":    return "unknown"
    case "Ident":   return lookupType(env, node.name)
    case "BinOp":
      if (["+","-","*","/","%","**"].includes(node.op)) {
        const lt = inferType(node.left, env)
        const rt = inferType(node.right, env)
        if (lt === "str" || rt === "str") return "str"
        return "num"
      }
      return "bool"
    case "UnaryOp":
      return node.op === "!" ? "bool" : "num"
    case "Call": {
      const name = node.callee.kind === "Ident" ? node.callee.name : ""
      const mathFns = ["sqrt","abs","floor","ceil","round","pow","min","max","random","randomInt","len","toNumber","toInt"]
      const strFns  = ["upper","lower","trim","toStr","replace","join"]
      const boolFns = ["startsWith","endsWith","includes","every","some"]
      if (mathFns.includes(name)) return "num"
      if (strFns.includes(name))  return "str"
      if (boolFns.includes(name)) return "bool"
      return "unknown"
    }
    default: return "unknown"
  }
}

// ── C expression emitter ─────────────────────────────────────────────
function cExpr(node: Node, env: Env): string {
  switch (node.kind) {
    case "Number": return String(node.value)
    case "Bool":   return node.value ? "1" : "0"
    case "Null":   return "0"
    case "String": return `zap_str(${JSON.stringify(node.value)})`

    case "Template": {
      // Convert `Hello {name}` to C string concat
      const parts = node.value.split(/\{([^}]+)\}/)
      let result = `zap_str("")`
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          if (parts[i]) result = `zap_str_concat(${result}, zap_str(${JSON.stringify(parts[i])}))`
        } else {
          const inner = parts[i].trim()
          const t = lookupType(env, inner)
          if (t === "num" || t === "unknown") {
            result = `zap_str_concat(${result}, zap_num_to_str(${inner}))`
          } else if (t === "bool") {
            result = `zap_str_concat(${result}, zap_str(${inner} ? "true" : "false"))`
          } else {
            result = `zap_str_concat(${result}, ${inner})`
          }
        }
      }
      return result
    }

    case "Ident": return node.name

    case "BinOp": {
      const lt = inferType(node.left, env)
      const rt = inferType(node.right, env)

      // String concatenation with +
      if (node.op === "+" && (lt === "str" || rt === "str")) {
        const l = lt === "str" ? cExpr(node.left, env) : `zap_num_to_str(${cExpr(node.left, env)})`
        const r = rt === "str" ? cExpr(node.right, env) : `zap_num_to_str(${cExpr(node.right, env)})`
        return `zap_str_concat(${l}, ${r})`
      }
      // String equality
      if ((node.op === "===" || node.op === "==") && (lt === "str" || rt === "str")) {
        return `zap_str_eq(${cExpr(node.left, env)}, ${cExpr(node.right, env)})`
      }
      if ((node.op === "!==" || node.op === "!=") && (lt === "str" || rt === "str")) {
        return `!zap_str_eq(${cExpr(node.left, env)}, ${cExpr(node.right, env)})`
      }
      // Power
      if (node.op === "**") return `pow(${cExpr(node.left, env)}, ${cExpr(node.right, env)})`
      // Modulo needs integer cast
      if (node.op === "%") return `((double)((long long)${cExpr(node.left, env)} % (long long)${cExpr(node.right, env)}))`
      // Normal
      const op = node.op === "===" ? "==" : node.op === "!==" ? "!=" : node.op
      return `(${cExpr(node.left, env)} ${op} ${cExpr(node.right, env)})`
    }

    case "UnaryOp":
      return `${node.op}${cExpr(node.expr, env)}`

    case "PostfixOp":
      return `${cExpr(node.expr, env)}${node.op}`

    case "Ternary":
      return `(${cExpr(node.cond, env)} ? ${cExpr(node.then, env)} : ${cExpr(node.else, env)})`

    case "Call": {
      if (node.callee.kind !== "Ident") return "0"
      const name = node.callee.name
      const args = node.args.map(a => cExpr(a, env))

      switch (name) {
        case "print":
        case "println": {
          if (!node.args[0]) return `printf("\\n")`
          const t = inferType(node.args[0], env)
          // If it's a call to a user function, treat as num (all user fns return double)
          const C_BUILTINS = new Set(["sqrt","abs","floor","ceil","round","pow","min","max","random","randomInt","upper","lower","len","toNumber","toInt","toStr","startsWith","endsWith"])
          const isUserFnCall = node.args[0].kind === "Call" &&
            node.args[0].callee.kind === "Ident" &&
            !C_BUILTINS.has((node.args[0].callee as any).name)
          if (isUserFnCall || t === "num") return `zap_print_num(${args[0]})`
          if (t === "bool") return `zap_print_bool(${args[0]})`
          if (t === "str") return `zap_print_str(${args[0]})`
          // fallback: try num
          return `zap_print_num(${args[0]})`
        }
        case "sqrt":      return `zap_sqrt(${args[0]})`
        case "abs":       return `zap_abs(${args[0]})`
        case "floor":     return `zap_floor(${args[0]})`
        case "ceil":      return `zap_ceil(${args[0]})`
        case "round":     return `zap_round(${args[0]})`
        case "pow":       return `zap_pow(${args[0]}, ${args[1]})`
        case "min":       return `zap_min(${args[0]}, ${args[1]})`
        case "max":       return `zap_max(${args[0]}, ${args[1]})`
        case "random":    return `zap_random()`
        case "randomInt": return `zap_random_int(${args[0]}, ${args[1]})`
        case "upper":     return `zap_upper(${args[0]})`
        case "lower":     return `zap_lower(${args[0]})`
        case "len":       return `zap_len_str(${args[0]})`
        case "toNumber":
        case "toInt":     return `atof(${args[0]}.data)`
        case "toStr":     return `zap_num_to_str(${args[0]})`
        case "startsWith":return `zap_starts_with(${args[0]}, ${args[1]})`
        case "endsWith":  return `zap_ends_with(${args[0]}, ${args[1]})`
        default:          return `${name}(${args.join(", ")})`
      }
    }

    default:
      return "0"
  }
}

// ── C statement emitter ──────────────────────────────────────────────
function cStmt(node: Node, env: Env, indent: number): string {
  const pad = "    ".repeat(indent)

  switch (node.kind) {
    case "VarDecl": {
      const t = inferType(node.value, env)
      env.vars.set(node.name, t)
      const ctype = t === "str" ? "ZapString" : t === "bool" ? "int" : "double"
      return `${pad}${ctype} ${node.name} = ${cExpr(node.value, env)};`
    }

    case "Assign": {
      if (node.target.kind !== "Ident") return ""
      const name = (node.target as any).name
      return `${pad}${name} ${node.op} ${cExpr(node.value, env)};`
    }

    case "FnDecl": {
      const childEnv = newEnv(env)
      node.params.forEach(p => childEnv.vars.set(p, "unknown"))
      const params = node.params.map(p => `double ${p}`).join(", ")
      const body = node.body.map(n => cStmt(n, childEnv, indent + 1)).join("\n")
      // Detect return type
      const retType = detectReturnType(node.body, childEnv)
      const cRetType = retType === "str" ? "ZapString" : retType === "bool" ? "int" : "double"
      return `${pad}${cRetType} ${node.name}(${params || "void"}) {\n${body}\n${pad}}`
    }

    case "Return": {
      if (!node.value) return `${pad}return;`
      return `${pad}return ${cExpr(node.value, env)};`
    }

    case "If": {
      let out = `${pad}if (${cExpr(node.cond, env)}) {\n`
      const thenEnv = newEnv(env)
      out += node.then.map(n => cStmt(n, thenEnv, indent + 1)).join("\n")
      out += `\n${pad}}`
      for (const ei of node.elif) {
        const eiEnv = newEnv(env)
        out += ` else if (${cExpr(ei.cond, env)}) {\n`
        out += ei.body.map(n => cStmt(n, eiEnv, indent + 1)).join("\n")
        out += `\n${pad}}`
      }
      if (node.else.length > 0) {
        const elseEnv = newEnv(env)
        out += ` else {\n`
        out += node.else.map(n => cStmt(n, elseEnv, indent + 1)).join("\n")
        out += `\n${pad}}`
      }
      return out
    }

    case "While": {
      const loopEnv = newEnv(env)
      return [
        `${pad}while (${cExpr(node.cond, env)}) {`,
        node.body.map(n => cStmt(n, loopEnv, indent + 1)).join("\n"),
        `${pad}}`
      ].join("\n")
    }

    case "Loop": {
      const loopEnv = newEnv(env)
      loopEnv.vars.set(node.var, "num")
      const step = node.step ? cExpr(node.step, env) : "1"
      return [
        `${pad}for (double ${node.var} = ${cExpr(node.from, env)}; ${node.var} < ${cExpr(node.to, env)}; ${node.var} += ${step}) {`,
        node.body.map(n => cStmt(n, loopEnv, indent + 1)).join("\n"),
        `${pad}}`
      ].join("\n")
    }

    case "Break":    return `${pad}break;`
    case "Continue": return `${pad}continue;`

    case "Call":
    case "PostfixOp":
    case "BinOp":
    case "UnaryOp":
      return `${pad}${cExpr(node, env)};`

    default:
      return ""
  }
}

function detectReturnType(body: Node[], env: Env): ZapType {
  for (const n of body) {
    if (n.kind === "Return" && n.value) return inferType(n.value, env)
  }
  return "void"
}

// ── Main entry point ─────────────────────────────────────────────────
export function generateC(program: Node): string {
  if (program.kind !== "Program") throw new Error("Expected Program node")

  const globalEnv = newEnv()
  const lines: string[] = []

  // Forward declarations for user functions
  const fwdDecls: string[] = []
  for (const node of program.body) {
    if (node.kind === "FnDecl") {
      const params = node.params.map(p => `double ${p}`).join(", ") || "void"
      const retEnv = newEnv(globalEnv)
      node.params.forEach(p => retEnv.vars.set(p, "unknown"))
      const retType = detectReturnType(node.body, retEnv)
      const cRetType = retType === "str" ? "ZapString" : retType === "bool" ? "int" : "double"
      fwdDecls.push(`${cRetType} ${node.name}(${params});`)
      globalEnv.vars.set(node.name, retType)
    }
  }

  // Emit body (functions first, then main statements)
  const fnDefs: string[] = []
  const mainStmts: string[] = []

  for (const node of program.body) {
    if (node.kind === "FnDecl") {
      fnDefs.push(cStmt(node, globalEnv, 0))
    } else {
      mainStmts.push(cStmt(node, globalEnv, 1))
    }
  }

  lines.push("/* Generated by Zap compiler — https://github.com/developermickey/zaplang */")
  lines.push(C_RUNTIME)
  lines.push("")
  if (fwdDecls.length > 0) {
    lines.push("/* Forward declarations */")
    lines.push(...fwdDecls)
    lines.push("")
  }
  if (fnDefs.length > 0) {
    lines.push(...fnDefs)
    lines.push("")
  }
  lines.push("int main(void) {")
  lines.push("    srand((unsigned)time(NULL));")
  lines.push(...mainStmts)
  lines.push("    return 0;")
  lines.push("}")

  return lines.join("\n") + "\n"
}
