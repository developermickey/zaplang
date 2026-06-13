import { Token, TokenType } from "./lexer"

export type Node =
  | { kind: "Program"; body: Node[] }
  | { kind: "VarDecl"; name: string; value: Node }
  | { kind: "Assign"; name: string; value: Node }
  | { kind: "FnDecl"; name: string; params: string[]; body: Node[] }
  | { kind: "AnonFn"; params: string[]; body: Node[] }
  | { kind: "If"; cond: Node; then: Node[]; elif: { cond: Node; body: Node[] }[]; else: Node[] }
  | { kind: "Loop"; var: string; from: Node; to: Node; body: Node[] }
  | { kind: "Return"; value: Node | null }
  | { kind: "Call"; callee: Node; args: Node[] }
  | { kind: "BinOp"; op: string; left: Node; right: Node }
  | { kind: "UnaryOp"; op: string; expr: Node }
  | { kind: "Number"; value: number }
  | { kind: "String"; value: string }
  | { kind: "Bool"; value: boolean }
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

  private peek(offset = 0): Token { return this.tokens[this.pos + offset] }
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
    while (!this.check("EOF")) body.push(this.parseStmt())
    return { kind: "Program", body }
  }

  private parseStmt(): Node {
    const t = this.peek()

    if (t.type === "LET")    return this.parseVarDecl()
    if (t.type === "FN")     return this.parseFnDecl()
    if (t.type === "IF")     return this.parseIf()
    if (t.type === "LOOP")   return this.parseLoop()
    if (t.type === "RETURN") return this.parseReturn()
    if (t.type === "SERVER") return this.parseServer()

    // assignment: ident =
    if (t.type === "IDENT" && this.peek(1).type === "EQ") return this.parseAssign()

    return this.parseExpr()
  }

  private parseVarDecl(): Node {
    this.expect("LET")
    const name = this.expect("IDENT").value
    this.expect("EQ")
    return { kind: "VarDecl", name, value: this.parseExpr() }
  }

  private parseAssign(): Node {
    const name = this.expect("IDENT").value
    this.expect("EQ")
    return { kind: "Assign", name, value: this.parseExpr() }
  }

  private parseFnDecl(): Node {
    this.expect("FN")
    const name = this.expect("IDENT").value
    const params = this.parseParams()
    this.expect("LBRACE")
    const body = this.parseBlock()
    this.expect("RBRACE")
    return { kind: "FnDecl", name, params, body }
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
    while (!this.check("RPAREN")) {
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

  private parseLoop(): Node {
    this.expect("LOOP")
    const varName = this.expect("IDENT").value
    this.expect("FROM")
    const from = this.parseExpr()
    this.expect("TO")
    const to = this.parseExpr()
    this.expect("LBRACE")
    const body = this.parseBlock()
    this.expect("RBRACE")
    return { kind: "Loop", var: varName, from, to, body }
  }

  private parseReturn(): Node {
    this.expect("RETURN")
    if (this.check("RBRACE") || this.check("EOF")) return { kind: "Return", value: null }
    return { kind: "Return", value: this.parseExpr() }
  }

  private parseServer(): Node {
    this.expect("SERVER")
    this.expect("ON")
    const port = this.parseExpr()
    this.expect("LBRACE")
    const routes: Route[] = []

    while (!this.check("RBRACE") && !this.check("EOF")) {
      const method = this.peek().type
      if (["GET", "POST", "PUT", "DELETE"].includes(method)) {
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
    while (!this.check("RBRACE") && !this.check("EOF")) stmts.push(this.parseStmt())
    return stmts
  }

  // --- Expression Parsing (precedence climbing) ---

  private parseExpr(): Node { return this.parseOr() }

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
    while (this.check("EQEQ") || this.check("NEQ")) { const op = this.advance().value; left = { kind: "BinOp", op, left, right: this.parseComparison() } }
    return left
  }

  private parseComparison(): Node {
    let left = this.parseAddSub()
    while (["LT", "GT", "LTE", "GTE"].includes(this.peek().type)) { const op = this.advance().value; left = { kind: "BinOp", op, left, right: this.parseAddSub() } }
    return left
  }

  private parseAddSub(): Node {
    let left = this.parseMulDiv()
    while (this.check("PLUS") || this.check("MINUS")) { const op = this.advance().value; left = { kind: "BinOp", op, left, right: this.parseMulDiv() } }
    return left
  }

  private parseMulDiv(): Node {
    let left = this.parseUnary()
    while (this.check("STAR") || this.check("SLASH") || this.check("PERCENT")) { const op = this.advance().value; left = { kind: "BinOp", op, left, right: this.parseUnary() } }
    return left
  }

  private parseUnary(): Node {
    if (this.check("NOT") || this.check("MINUS")) {
      const op = this.advance().value
      return { kind: "UnaryOp", op: op === "!" ? "!" : "-", expr: this.parseUnary() }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): Node {
    let expr = this.parsePrimary()
    while (true) {
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
      } else if (this.check("LBRACKET")) {
        this.advance()
        const index = this.parseExpr()
        this.expect("RBRACKET")
        expr = { kind: "Index", object: expr, index }
      } else if (this.check("LPAREN")) {
        this.advance()
        const args = this.parseArgList()
        expr = { kind: "Call", callee: expr, args }
      } else {
        break
      }
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

    if (t.type === "NUMBER") { this.advance(); return { kind: "Number", value: parseFloat(t.value) } }
    if (t.type === "STRING") { this.advance(); return { kind: "String", value: t.value } }
    if (t.type === "TRUE")   { this.advance(); return { kind: "Bool", value: true } }
    if (t.type === "FALSE")  { this.advance(); return { kind: "Bool", value: false } }
    if (t.type === "FN")     return this.parseAnonFn()

    if (t.type === "LBRACKET") {
      this.advance()
      const elements: Node[] = []
      while (!this.check("RBRACKET")) {
        elements.push(this.parseExpr())
        if (!this.check("RBRACKET")) this.expect("COMMA")
      }
      this.expect("RBRACKET")
      return { kind: "Array", elements }
    }

    if (t.type === "LBRACE") {
      this.advance()
      const pairs: { key: string; value: Node }[] = []
      while (!this.check("RBRACE")) {
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
      const expr = this.parseExpr()
      this.expect("RPAREN")
      return expr
    }

    if (t.type === "IDENT") {
      this.advance()
      return { kind: "Ident", name: t.value }
    }

    throw new Error(`[Zap] Line ${t.line}: Unexpected token '${t.type}' ("${t.value}")`)
  }
}
