import { Token, TokenType } from "./lexer"

export type Node =
  | { kind: "Program"; body: Node[] }
  | { kind: "VarDecl"; name: string; value: Node }
  | { kind: "Assign"; target: Node; op: string; value: Node }
  | { kind: "FnDecl"; name: string; params: string[]; body: Node[]; exported: boolean }
  | { kind: "AnonFn"; params: string[]; body: Node[] }
  | { kind: "ArrowFn"; params: string[]; body: Node | Node[] }
  | { kind: "If"; cond: Node; then: Node[]; elif: { cond: Node; body: Node[] }[]; else: Node[] }
  | { kind: "While"; cond: Node; body: Node[] }
  | { kind: "Loop"; var: string; from: Node; to: Node; step: Node | null; body: Node[] }
  | { kind: "Return"; value: Node | null }
  | { kind: "Break" }
  | { kind: "Continue" }
  | { kind: "Try"; body: Node[]; catchVar: string | null; catch: Node[]; finally: Node[] }
  | { kind: "Import"; path: string; names: string[]; alias: string | null }
  | { kind: "Call"; callee: Node; args: Node[] }
  | { kind: "BinOp"; op: string; left: Node; right: Node }
  | { kind: "UnaryOp"; op: string; expr: Node }
  | { kind: "PostfixOp"; op: string; expr: Node }
  | { kind: "Ternary"; cond: Node; then: Node; else: Node }
  | { kind: "Number"; value: number }
  | { kind: "String"; value: string }
  | { kind: "Template"; value: string }
  | { kind: "Bool"; value: boolean }
  | { kind: "Null" }
  | { kind: "Ident"; name: string }
  | { kind: "Array"; elements: Node[] }
  | { kind: "Object"; pairs: { key: string; value: Node }[] }
  | { kind: "Index"; object: Node; index: Node }
  | { kind: "Member"; object: Node; prop: string }
  | { kind: "Server"; port: Node; routes: Route[] }

export type Route = {
  method: string
  path: string
  handler: { params: string[]; body: Node[] }
}

export class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}

  private peek(offset = 0): Token { return this.tokens[this.pos + offset] ?? { type: "EOF", value: "", line: 0 } }
  private advance(): Token { return this.tokens[this.pos++] }
  private check(type: TokenType): boolean { return this.peek().type === type }

  private expect(type: TokenType): Token {
    if (!this.check(type)) {
      const t = this.peek()
      throw new Error(`[Zap] Line ${t.line}: Expected '${type}' but got '${t.type}' ("${t.value}")`)
    }
    return this.advance()
  }

  parse(): Node {
    const body: Node[] = []
    while (!this.check("EOF")) {
      if (this.check("SEMICOLON")) { this.advance(); continue }
      body.push(this.parseStmt())
    }
    return { kind: "Program", body }
  }

  private parseStmt(): Node {
    const t = this.peek()

    if (t.type === "SEMICOLON")  { this.advance(); return this.parseStmt() }
    if (t.type === "LET")        return this.parseVarDecl()
    if (t.type === "FN")         return this.parseFnDecl(false)
    if (t.type === "EXPORT")     { this.advance(); return this.parseFnDecl(true) }
    if (t.type === "IF")         return this.parseIf()
    if (t.type === "WHILE")      return this.parseWhile()
    if (t.type === "LOOP")       return this.parseLoop()
    if (t.type === "RETURN")     return this.parseReturn()
    if (t.type === "BREAK")      { this.advance(); return { kind: "Break" } }
    if (t.type === "CONTINUE")   { this.advance(); return { kind: "Continue" } }
    if (t.type === "TRY")        return this.parseTry()
    if (t.type === "IMPORT")     return this.parseImport()
    if (t.type === "SERVER")     return this.parseServer()

    // compound assignment: ident += / -= / *= / /=
    if (t.type === "IDENT" && ["PLUSEQ","MINUSEQ","STAREQ","SLASHEQ"].includes(this.peek(1).type)) {
      return this.parseCompoundAssign()
    }

    // simple assignment: ident = expr
    if (t.type === "IDENT" && this.peek(1).type === "EQ") return this.parseAssign()

    // member/index assignment: obj.prop = expr  OR  arr[i] = expr
    // Parse as expression; if we end up with Member/Index followed by EQ, rewrite as Assign
    const expr = this.parseExpr()
    if ((expr.kind === "Member" || expr.kind === "Index") && this.check("EQ")) {
      this.expect("EQ")
      return { kind: "Assign", target: expr, op: "=", value: this.parseExpr() }
    }
    return expr
  }

  private parseVarDecl(): Node {
    this.expect("LET")
    const name = this.expect("IDENT").value
    this.expect("EQ")
    return { kind: "VarDecl", name, value: this.parseExpr() }
  }

  private parseAssign(): Node {
    const nameToken = this.expect("IDENT")
    this.expect("EQ")
    return { kind: "Assign", target: { kind: "Ident", name: nameToken.value }, op: "=", value: this.parseExpr() }
  }

  private parseCompoundAssign(): Node {
    const name = this.expect("IDENT").value
    const op = this.advance().value // +=, -=, *=, /=
    return { kind: "Assign", target: { kind: "Ident", name }, op, value: this.parseExpr() }
  }

  private parseFnDecl(exported: boolean): Node {
    this.expect("FN")
    const name = this.expect("IDENT").value
    const params = this.parseParams()
    this.expect("LBRACE")
    const body = this.parseBlock()
    this.expect("RBRACE")
    return { kind: "FnDecl", name, params, body, exported }
  }

  private parseAnonFn(): Node {
    this.expect("FN")
    const params = this.check("LPAREN") ? this.parseParams() : []
    this.expect("LBRACE")
    const body = this.parseBlock()
    this.expect("RBRACE")
    return { kind: "AnonFn", params, body }
  }

  private parseParams(): string[] {
    this.expect("LPAREN")
    const params: string[] = []
    while (!this.check("RPAREN") && !this.check("EOF")) {
      params.push(this.expect("IDENT").value)
      if (!this.check("RPAREN")) this.expect("COMMA")
    }
    this.expect("RPAREN")
    return params
  }

  private parseIf(): Node {
    this.expect("IF")
    const cond = this.parseExpr()
    this.expect("LBRACE")
    const then = this.parseBlock()
    this.expect("RBRACE")
    const elif: { cond: Node; body: Node[] }[] = []
    let elseBlock: Node[] = []

    while (this.check("ELSE")) {
      this.advance()
      if (this.check("IF")) {
        this.advance()
        const ec = this.parseExpr()
        this.expect("LBRACE")
        const eb = this.parseBlock()
        this.expect("RBRACE")
        elif.push({ cond: ec, body: eb })
      } else {
        this.expect("LBRACE")
        elseBlock = this.parseBlock()
        this.expect("RBRACE")
        break
      }
    }
    return { kind: "If", cond, then, elif, else: elseBlock }
  }

  private parseWhile(): Node {
    this.expect("WHILE")
    const cond = this.parseExpr()
    this.expect("LBRACE")
    const body = this.parseBlock()
    this.expect("RBRACE")
    return { kind: "While", cond, body }
  }

  private parseLoop(): Node {
    this.expect("LOOP")
    const varName = this.expect("IDENT").value
    this.expect("FROM")
    const from = this.parseExpr()
    this.expect("TO")
    const to = this.parseExpr()
    // optional step
    let step: Node | null = null
    if (this.check("IDENT") && this.peek().value === "step") {
      this.advance()
      step = this.parseExpr()
    }
    this.expect("LBRACE")
    const body = this.parseBlock()
    this.expect("RBRACE")
    return { kind: "Loop", var: varName, from, to, step, body }
  }

  private parseReturn(): Node {
    this.expect("RETURN")
    if (this.check("RBRACE") || this.check("EOF") || this.check("SEMICOLON")) {
      return { kind: "Return", value: null }
    }
    return { kind: "Return", value: this.parseExpr() }
  }

  private parseTry(): Node {
    this.expect("TRY")
    this.expect("LBRACE")
    const tryBody = this.parseBlock()
    this.expect("RBRACE")
    let catchVar: string | null = null
    let catchBody: Node[] = []
    let finallyBody: Node[] = []

    if (this.check("CATCH")) {
      this.advance()
      if (this.check("LPAREN")) {
        this.advance()
        catchVar = this.expect("IDENT").value
        this.expect("RPAREN")
      }
      this.expect("LBRACE")
      catchBody = this.parseBlock()
      this.expect("RBRACE")
    }
    if (this.check("FINALLY")) {
      this.advance()
      this.expect("LBRACE")
      finallyBody = this.parseBlock()
      this.expect("RBRACE")
    }
    return { kind: "Try", body: tryBody, catchVar, catch: catchBody, finally: finallyBody }
  }

  private parseImport(): Node {
    this.expect("IMPORT")
    // import "path"
    // import name from "path"
    // import { a, b } from "path"
    const names: string[] = []
    let alias: string | null = null

    if (this.check("STRING")) {
      const path = this.advance().value
      return { kind: "Import", path, names: [], alias: null }
    }

    if (this.check("LBRACE")) {
      this.advance()
      while (!this.check("RBRACE") && !this.check("EOF")) {
        names.push(this.expect("IDENT").value)
        if (!this.check("RBRACE")) this.expect("COMMA")
      }
      this.expect("RBRACE")
    } else if (this.check("IDENT")) {
      alias = this.advance().value
    }

    // from "path" — FROM is a keyword token
    if (this.check("FROM") || (this.check("IDENT") && this.peek().value === "from")) this.advance()
    const path = this.expect("STRING").value
    return { kind: "Import", path, names, alias }
  }

  private parseServer(): Node {
    this.expect("SERVER")
    this.expect("ON")
    const port = this.parseExpr()
    this.expect("LBRACE")
    const routes: Route[] = []

    while (!this.check("RBRACE") && !this.check("EOF")) {
      const method = this.peek().type
      if (["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        this.advance()
        const path = this.expect("STRING").value
        this.expect("ARROW")
        const fn = this.parseAnonFn() as { kind: "AnonFn"; params: string[]; body: Node[] }
        routes.push({ method, path, handler: { params: fn.params, body: fn.body } })
      } else {
        this.advance()
      }
    }
    this.expect("RBRACE")
    return { kind: "Server", port, routes }
  }

  private parseBlock(): Node[] {
    const stmts: Node[] = []
    while (!this.check("RBRACE") && !this.check("EOF")) {
      if (this.check("SEMICOLON")) { this.advance(); continue }
      stmts.push(this.parseStmt())
    }
    return stmts
  }

  // ── Expression Parsing ──────────────────────────────────────────────

  private parseExpr(): Node { return this.parseTernary() }

  private parseTernary(): Node {
    const cond = this.parseOr()
    if (this.check("QUESTION")) {
      this.advance()
      const then = this.parseExpr()
      this.expect("COLON")
      const els = this.parseExpr()
      return { kind: "Ternary", cond, then, else: els }
    }
    return cond
  }

  private parseOr(): Node {
    let left = this.parseAnd()
    while (this.check("OR")) { const op = this.advance().value; left = { kind: "BinOp", op, left, right: this.parseAnd() } }
    return left
  }

  private parseAnd(): Node {
    let left = this.parseEquality()
    while (this.check("AND")) { const op = this.advance().value; left = { kind: "BinOp", op, left, right: this.parseEquality() } }
    return left
  }

  private parseEquality(): Node {
    let left = this.parseComparison()
    while (this.check("EQEQ") || this.check("NEQ")) { const op = this.advance().value; left = { kind: "BinOp", op: op === "==" ? "===" : "!==", left, right: this.parseComparison() } }
    return left
  }

  private parseComparison(): Node {
    let left = this.parseAddSub()
    while (["LT","GT","LTE","GTE"].includes(this.peek().type)) { const op = this.advance().value; left = { kind: "BinOp", op, left, right: this.parseAddSub() } }
    return left
  }

  private parseAddSub(): Node {
    let left = this.parseMulDiv()
    while (this.check("PLUS") || this.check("MINUS")) { const op = this.advance().value; left = { kind: "BinOp", op, left, right: this.parseMulDiv() } }
    return left
  }

  private parseMulDiv(): Node {
    let left = this.parsePower()
    while (this.check("STAR") || this.check("SLASH") || this.check("PERCENT")) { const op = this.advance().value; left = { kind: "BinOp", op, left, right: this.parsePower() } }
    return left
  }

  private parsePower(): Node {
    let left = this.parseUnary()
    if (this.check("POWER")) { this.advance(); return { kind: "BinOp", op: "**", left, right: this.parsePower() } }
    return left
  }

  private parseUnary(): Node {
    if (this.check("NOT"))   { this.advance(); return { kind: "UnaryOp", op: "!", expr: this.parseUnary() } }
    if (this.check("MINUS")) { this.advance(); return { kind: "UnaryOp", op: "-", expr: this.parseUnary() } }
    if (this.check("PLUSPLUS"))   { this.advance(); return { kind: "UnaryOp", op: "++", expr: this.parseUnary() } }
    if (this.check("MINUSMINUS")) { this.advance(); return { kind: "UnaryOp", op: "--", expr: this.parseUnary() } }
    return this.parsePostfix()
  }

  private parsePostfix(): Node {
    let expr = this.parsePrimary()
    while (true) {
      if (this.check("PLUSPLUS"))   { this.advance(); expr = { kind: "PostfixOp", op: "++", expr }; continue }
      if (this.check("MINUSMINUS")) { this.advance(); expr = { kind: "PostfixOp", op: "--", expr }; continue }
      if (this.check("DOT")) {
        this.advance()
        const prop = this.expect("IDENT").value
        if (this.check("LPAREN")) {
          this.advance()
          const args = this.parseArgList()
          expr = { kind: "Call", callee: { kind: "Member", object: expr, prop }, args }
        } else {
          expr = { kind: "Member", object: expr, prop }
        }
        continue
      }
      if (this.check("LBRACKET")) {
        this.advance()
        const index = this.parseExpr()
        this.expect("RBRACKET")
        expr = { kind: "Index", object: expr, index }
        continue
      }
      if (this.check("LPAREN")) {
        this.advance()
        const args = this.parseArgList()
        expr = { kind: "Call", callee: expr, args }
        continue
      }
      break
    }
    return expr
  }

  private parseArgList(): Node[] {
    const args: Node[] = []
    while (!this.check("RPAREN") && !this.check("EOF")) {
      args.push(this.parseExpr())
      if (!this.check("RPAREN")) this.expect("COMMA")
    }
    this.expect("RPAREN")
    return args
  }

  private parsePrimary(): Node {
    const t = this.peek()

    if (t.type === "NUMBER")   { this.advance(); return { kind: "Number", value: parseFloat(t.value) } }
    if (t.type === "STRING")   { this.advance(); return { kind: "String", value: t.value } }
    if (t.type === "TEMPLATE") { this.advance(); return { kind: "Template", value: t.value } }
    if (t.type === "TRUE")     { this.advance(); return { kind: "Bool", value: true } }
    if (t.type === "FALSE")    { this.advance(); return { kind: "Bool", value: false } }
    if (t.type === "NULL")     { this.advance(); return { kind: "Null" } }
    if (t.type === "FN")       return this.parseAnonFn()

    if (t.type === "LBRACKET") {
      this.advance()
      const elements: Node[] = []
      while (!this.check("RBRACKET") && !this.check("EOF")) {
        elements.push(this.parseExpr())
        if (!this.check("RBRACKET")) this.expect("COMMA")
      }
      this.expect("RBRACKET")
      return { kind: "Array", elements }
    }

    if (t.type === "LBRACE") {
      this.advance()
      const pairs: { key: string; value: Node }[] = []
      while (!this.check("RBRACE") && !this.check("EOF")) {
        const key = this.expect("IDENT").value
        this.expect("COLON")
        const value = this.parseExpr()
        pairs.push({ key, value })
        if (!this.check("RBRACE")) this.expect("COMMA")
      }
      this.expect("RBRACE")
      return { kind: "Object", pairs }
    }

    if (t.type === "LPAREN") {
      this.advance()
      const e = this.parseExpr()
      this.expect("RPAREN")
      return e
    }

    if (t.type === "IDENT") {
      this.advance()
      return { kind: "Ident", name: t.value }
    }

    throw new Error(`[Zap] Line ${t.line}: Unexpected token '${t.type}' ("${t.value}")`)
  }
}
