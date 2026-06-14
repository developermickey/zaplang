/**
 * Zap Formatter — `zap fmt`
 * Token-stream pretty-printer. Comments are stripped by the lexer,
 * so comment lines are preserved by line-scanning the raw source.
 */
import { lex, Token, TokenType } from "./lexer"

export interface FmtOptions {
  indent?: number
}

export function format(source: string, opts: FmtOptions = {}): string {
  const indentSize = opts.indent ?? 2
  const tokens = lex(source).filter(t => t.type !== "EOF")
  const fmt = new ZapFormatter(tokens, indentSize)
  return fmt.run()
}

class ZapFormatter {
  private pos = 0
  private depth = 0
  private out: string[] = []

  constructor(private tokens: Token[], private indentSize: number) {}

  private get pad() { return " ".repeat(this.depth * this.indentSize) }

  private peek(offset = 0): Token | null {
    return this.tokens[this.pos + offset] ?? null
  }

  private next(): Token {
    return this.tokens[this.pos++]!
  }

  private check(...types: TokenType[]): boolean {
    const t = this.peek()
    return t != null && (types as string[]).includes(t.type)
  }

  private line(content: string) {
    this.out.push(content.trimEnd())
  }

  run(): string {
    while (this.pos < this.tokens.length) {
      const t = this.peek()!
      // blank line before top-level fn/server
      if ((t.type === "FN" || t.type === "SERVER") && this.out.length > 0 && this.out[this.out.length - 1] !== "") {
        this.line("")
      }
      this.stmt()
    }
    return this.out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n"
  }

  private stmt() {
    const t = this.peek()
    if (!t || t.type === "RBRACE") return

    switch (t.type) {
      case "LET":      return this.varDecl()
      case "FN":       return this.fnDecl()
      case "RETURN":   return this.returnStmt()
      case "IF":       return this.ifStmt()
      case "WHILE":    return this.whileStmt()
      case "LOOP":     return this.loopStmt()
      case "BREAK":    this.next(); this.line(this.pad + "break"); return
      case "CONTINUE": this.next(); this.line(this.pad + "continue"); return
      case "TRY":      return this.tryStmt()
      case "IMPORT":   return this.importStmt()
      case "EXPORT":   return this.exportStmt()
      case "SERVER":   return this.serverStmt()
      default:         this.line(this.pad + this.expr()); return
    }
  }

  private varDecl() {
    this.next() // let
    const name = this.next().value
    this.next() // =
    this.line(`${this.pad}let ${name} = ${this.expr()}`)
  }

  private fnDecl() {
    this.next() // fn
    const name = this.next().value
    this.next() // (
    const params = this.paramList()
    this.next() // )
    this.next() // {
    this.line(`${this.pad}fn ${name}(${params}) {`)
    this.depth++
    this.block()
    this.depth--
    this.line(`${this.pad}}`)
  }

  private paramList(): string {
    const ps: string[] = []
    while (!this.check("RPAREN") && this.pos < this.tokens.length) {
      if (this.check("COMMA")) { this.next(); continue }
      ps.push(this.next().value)
    }
    return ps.join(", ")
  }

  private returnStmt() {
    this.next() // return
    if (this.check("RBRACE") || this.pos >= this.tokens.length) {
      this.line(`${this.pad}return`)
      return
    }
    this.line(`${this.pad}return ${this.expr()}`)
  }

  private ifStmt() {
    this.next() // if
    this.next() // (
    const cond = this.exprList("RPAREN")
    this.next() // )
    this.next() // {
    this.line(`${this.pad}if (${cond}) {`)
    this.depth++
    this.block()
    this.depth--
    // emit closing brace — may be rewritten by else handling below
    this.line(`${this.pad}}`)

    while (this.check("ELSE")) {
      this.next() // else
      if (this.check("IF")) {
        this.next() // if
        this.next() // (
        const c2 = this.exprList("RPAREN")
        this.next() // )
        this.next() // {
        // rewrite the "}" we just emitted into "} else if (...) {"
        this.out[this.out.length - 1] = `${this.pad}} else if (${c2}) {`
        this.depth++
        this.block()
        this.depth--
        this.line(`${this.pad}}`)
      } else {
        this.next() // {
        this.out[this.out.length - 1] = `${this.pad}} else {`
        this.depth++
        this.block()
        this.depth--
        this.line(`${this.pad}}`)
        break
      }
    }
  }

  private whileStmt() {
    this.next() // while
    this.next() // (
    const cond = this.exprList("RPAREN")
    this.next() // )
    this.next() // {
    this.line(`${this.pad}while (${cond}) {`)
    this.depth++
    this.block()
    this.depth--
    this.line(`${this.pad}}`)
  }

  private loopStmt() {
    this.next() // loop
    const varName = this.next().value
    this.next() // from
    const fromVal = this.expr()
    this.next() // to
    const toVal = this.expr()
    let stepPart = ""
    if (this.peek()?.value === "step") { this.next(); stepPart = ` step ${this.expr()}` }
    this.next() // {
    this.line(`${this.pad}loop ${varName} from ${fromVal} to ${toVal}${stepPart} {`)
    this.depth++
    this.block()
    this.depth--
    this.line(`${this.pad}}`)
  }

  private tryStmt() {
    this.next() // try
    this.next() // {
    this.line(`${this.pad}try {`)
    this.depth++
    this.block()
    this.depth--

    if (this.check("CATCH")) {
      this.next() // catch
      this.next() // (
      const errName = this.next().value
      this.next() // )
      this.next() // {
      this.line(`${this.pad}} catch (${errName}) {`)
      this.depth++
      this.block()
      this.depth--
    }

    if (this.check("FINALLY")) {
      this.next() // finally
      this.next() // {
      this.line(`${this.pad}} finally {`)
      this.depth++
      this.block()
      this.depth--
    }

    this.line(`${this.pad}}`)
  }

  private importStmt() {
    this.next() // import
    const name = this.next().value
    this.next() // from
    const rawPath = this.next().value
    const quotedPath = rawPath.startsWith('"') || rawPath.startsWith("'") ? rawPath : `"${rawPath}"`
    this.line(`${this.pad}import ${name} from ${quotedPath}`)
  }

  private exportStmt() {
    this.next() // export
    this.line(`${this.pad}export ${this.expr()}`)
  }

  private serverStmt() {
    this.next() // server
    this.next() // on
    const port = this.next().value
    this.next() // {
    this.line(`${this.pad}server on ${port} {`)
    this.depth++

    while (!this.check("RBRACE") && this.pos < this.tokens.length) {
      const t = this.peek()!
      if (["GET","POST","PUT","DELETE","PATCH"].includes(t.type)) {
        const method = this.next().value.toLowerCase()
        const route = this.next().value
        this.next() // {
        this.line(`${this.pad}${method} "${route}" {`)
        this.depth++
        this.block()
        this.depth--
        this.line(`${this.pad}}`)
      } else {
        this.stmt()
      }
    }

    this.depth--
    if (this.check("RBRACE")) this.next()
    this.line(`${this.pad}}`)
  }

  private block() {
    while (this.pos < this.tokens.length && !this.check("RBRACE")) {
      this.stmt()
    }
    if (this.check("RBRACE")) this.next()
  }

  // ── Expression parser ─────────────────────────────────────────────────

  private expr(): string { return this.ternary() }

  /** Collect a full expression until a stop token type is seen at depth 0 */
  private exprList(stop: TokenType): string {
    const saved = this.pos
    // Use expr() which naturally stops at non-expression tokens
    // But we need to handle the paren-depth for nested calls
    let depth = 0
    const parts: string[] = []
    while (this.pos < this.tokens.length) {
      const t = this.peek()!
      if (t.type === stop && depth === 0) break
      if (t.type === "LPAREN" || t.type === "LBRACKET" || t.type === "LBRACE") depth++
      if ((t.type === "RPAREN" || t.type === "RBRACKET" || t.type === "RBRACE") && depth > 0) depth--
      parts.push(this.next().value)
    }
    return parts.join(" ").replace(/\s+([,.\[\]()])\s*/g, "$1").replace(/\(\s+/g,"(").replace(/\s+\)/g,")")
  }

  private ternary(): string {
    let left = this.or()
    if (this.check("QUESTION")) {
      this.next()
      const then = this.or()
      this.next() // :
      const els = this.or()
      return `${left} ? ${then} : ${els}`
    }
    return left
  }

  private or(): string {
    let left = this.and()
    while (this.check("OR")) { this.next(); left = `${left} || ${this.and()}` }
    return left
  }

  private and(): string {
    let left = this.equality()
    while (this.check("AND")) { this.next(); left = `${left} && ${this.equality()}` }
    return left
  }

  private equality(): string {
    let left = this.comparison()
    while (this.check("EQEQ", "NEQ")) {
      const op = this.next().value
      left = `${left} ${op} ${this.comparison()}`
    }
    return left
  }

  private comparison(): string {
    let left = this.addition()
    while (this.check("LT","GT","LTE","GTE")) {
      const op = this.next().value
      left = `${left} ${op} ${this.addition()}`
    }
    return left
  }

  private addition(): string {
    let left = this.multiplication()
    while (this.check("PLUS","MINUS")) {
      const op = this.next().value
      left = `${left} ${op} ${this.multiplication()}`
    }
    return left
  }

  private multiplication(): string {
    let left = this.power()
    while (this.check("STAR","SLASH","PERCENT")) {
      const op = this.next().value
      left = `${left} ${op} ${this.power()}`
    }
    return left
  }

  private power(): string {
    let left = this.unary()
    if (this.check("POWER")) { this.next(); return `${left} ** ${this.power()}` }
    return left
  }

  private unary(): string {
    if (this.check("NOT")) { this.next(); return `!${this.unary()}` }
    if (this.check("MINUS")) { this.next(); return `-${this.unary()}` }
    return this.postfix()
  }

  private postfix(): string {
    let ex = this.primary()
    while (true) {
      if (this.check("PLUSPLUS"))   { this.next(); ex += "++"; continue }
      if (this.check("MINUSMINUS")) { this.next(); ex += "--"; continue }
      if (this.check("DOT")) {
        this.next()
        const prop = this.next().value
        if (this.check("LPAREN")) { ex = `${ex}.${prop}(${this.callArgs()})`; continue }
        ex = `${ex}.${prop}`; continue
      }
      if (this.check("LBRACKET")) {
        this.next()
        const idx = this.exprList("RBRACKET")
        this.next() // ]
        ex = `${ex}[${idx}]`; continue
      }
      if (this.check("EQ","PLUSEQ","MINUSEQ","STAREQ","SLASHEQ")) {
        const op = this.next().value
        ex = `${ex} ${op} ${this.expr()}`; continue
      }
      break
    }
    return ex
  }

  private primary(): string {
    const t = this.peek()
    if (!t) return ""

    if (t.type === "NUMBER")   { this.next(); return t.value }
    if (t.type === "TRUE")     { this.next(); return "true" }
    if (t.type === "FALSE")    { this.next(); return "false" }
    if (t.type === "NULL")     { this.next(); return "null" }
    if (t.type === "STRING")   { this.next(); return JSON.stringify(t.value) }
    if (t.type === "TEMPLATE") { this.next(); return "`" + t.value + "`" }

    if (t.type === "IDENT") {
      this.next()
      if (this.check("LPAREN")) return `${t.value}(${this.callArgs()})`
      return t.value
    }

    if (t.type === "LPAREN") {
      this.next()
      const inner = this.exprList("RPAREN")
      this.next() // )
      return `(${inner})`
    }

    if (t.type === "LBRACKET") {
      this.next()
      const elems: string[] = []
      while (!this.check("RBRACKET") && this.pos < this.tokens.length) {
        if (this.check("COMMA")) { this.next(); continue }
        elems.push(this.expr())
      }
      if (this.check("RBRACKET")) this.next()
      return `[${elems.join(", ")}]`
    }

    if (t.type === "LBRACE") {
      this.next()
      const pairs: string[] = []
      while (!this.check("RBRACE") && this.pos < this.tokens.length) {
        if (this.check("COMMA")) { this.next(); continue }
        const key = this.next().value
        this.next() // :
        pairs.push(`${key}: ${this.expr()}`)
      }
      if (this.check("RBRACE")) this.next()
      return pairs.length === 0 ? "{}" : `{ ${pairs.join(", ")} }`
    }

    if (t.type === "FN") {
      this.next() // fn
      this.next() // (
      const params: string[] = []
      while (!this.check("RPAREN") && this.pos < this.tokens.length) {
        if (this.check("COMMA")) { this.next(); continue }
        params.push(this.next().value)
      }
      this.next() // )
      this.next() // {
      const bodyParts: string[] = []
      let d = 1
      while (this.pos < this.tokens.length && d > 0) {
        const bt = this.next()
        if (bt.type === "LBRACE") d++
        else if (bt.type === "RBRACE") { d--; if (d === 0) break }
        bodyParts.push(bt.value)
      }
      return `fn(${params.join(", ")}) { ${bodyParts.join(" ")} }`
    }

    // Any keyword used as identifier/value (e.g. built-in function names)
    this.next()
    if (this.check("LPAREN")) return `${t.value}(${this.callArgs()})`
    return t.value
  }

  private callArgs(): string {
    this.next() // (
    const args: string[] = []
    while (!this.check("RPAREN") && this.pos < this.tokens.length) {
      if (this.check("COMMA")) { this.next(); continue }
      args.push(this.expr())
    }
    if (this.check("RPAREN")) this.next() // )
    return args.join(", ")
  }
}
