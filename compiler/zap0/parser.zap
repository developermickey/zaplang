package compiler.zap0

struct Parser {
  tokens: List<Token>
  current: Int
  diagnostics: Diagnostics
}

fn parse(tokens: List<Token>) -> Result<Program, Diagnostics> {
  let parser = Parser {
    tokens: tokens,
    current: 0,
    diagnostics: diagnostics()
  }

  const packageName = parsePackage(parser)
  let decls = List<Decl>()

  while !parser.isAtEnd() {
    decls.push(Decl.Function(parseFunction(parser)))
  }

  if parser.diagnostics.items.len > 0 {
    return err(parser.diagnostics)
  }

  return ok(Program {
    packageName: packageName,
    decls: decls
  })
}

fn parsePackage(parser: Parser) -> String {
  if parser.match(TokenKind.Package) {
    return parser.consumeIdentifier("Expected package name")
  }

  return "main"
}

fn parseFunction(parser: Parser) -> FnDecl {
  const start = parser.consume(TokenKind.Fn, "Expected function declaration")
  const name = parser.consumeIdentifier("Expected function name")

  parser.consume(TokenKind.LeftParen, "Expected '(' after function name")
  const params = parseParams(parser)
  parser.consume(TokenKind.RightParen, "Expected ')' after parameters")

  let returnType = TypeRef.Void
  if parser.match(TokenKind.Arrow) {
    returnType = parseType(parser)
  }

  return FnDecl {
    name: name,
    params: params,
    returnType: returnType,
    body: parseBlock(parser),
    span: start.span
  }
}

fn parseParams(parser: Parser) -> List<Param> {
  let params = List<Param>()

  if parser.check(TokenKind.RightParen) {
    return params
  }

  loop {
    const name = parser.consumeIdentifier("Expected parameter name")
    parser.consume(TokenKind.Colon, "Expected ':' after parameter name")
    params.push(Param {
      name: name,
      typeRef: parseType(parser)
    })

    if !parser.match(TokenKind.Comma) {
      break
    }
  }

  return params
}

fn parseType(parser: Parser) -> TypeRef {
  if parser.match(TokenKind.TypeInt) { return TypeRef.Int }
  if parser.match(TokenKind.TypeBool) { return TypeRef.Bool }
  if parser.match(TokenKind.TypeString) { return TypeRef.String }
  if parser.match(TokenKind.TypeVoid) { return TypeRef.Void }

  return TypeRef.Named(parser.consumeIdentifier("Expected type name"))
}

fn parseBlock(parser: Parser) -> Block {
  parser.consume(TokenKind.LeftBrace, "Expected '{'")
  let statements = List<Stmt>()

  while !parser.check(TokenKind.RightBrace) && !parser.isAtEnd() {
    statements.push(parseStatement(parser))
  }

  parser.consume(TokenKind.RightBrace, "Expected '}'")
  return Block { statements: statements }
}

fn parseStatement(parser: Parser) -> Stmt {
  if parser.match(TokenKind.Let) { return parseLet(parser, false) }
  if parser.match(TokenKind.Const) { return parseLet(parser, true) }
  if parser.match(TokenKind.Return) { return parseReturn(parser) }
  if parser.match(TokenKind.If) { return parseIf(parser) }
  if parser.match(TokenKind.While) { return parseWhile(parser) }

  return Stmt.ExprOnly(parseExpression(parser))
}

fn parseLet(parser: Parser, isConst: Bool) -> Stmt {
  const name = parser.consumeIdentifier("Expected binding name")
  let typeRef = none<TypeRef>()

  if parser.match(TokenKind.Colon) {
    typeRef = some(parseType(parser))
  }

  parser.consume(TokenKind.Equal, "Expected '=' after binding name")
  const value = parseExpression(parser)

  if isConst {
    return Stmt.Const(name, typeRef, value)
  }

  return Stmt.Let(name, typeRef, value)
}

fn parseReturn(parser: Parser) -> Stmt {
  if parser.check(TokenKind.RightBrace) {
    return Stmt.Return(none<Expr>())
  }

  return Stmt.Return(some(parseExpression(parser)))
}

fn parseIf(parser: Parser) -> Stmt {
  const condition = parseExpression(parser)
  const thenBlock = parseBlock(parser)
  let elseBlock = none<Block>()

  if parser.match(TokenKind.Else) {
    elseBlock = some(parseBlock(parser))
  }

  return Stmt.If(condition, thenBlock, elseBlock)
}

fn parseWhile(parser: Parser) -> Stmt {
  const condition = parseExpression(parser)
  return Stmt.While(condition, parseBlock(parser))
}

fn parseExpression(parser: Parser) -> Expr {
  return parseAssignment(parser)
}

fn parseAssignment(parser: Parser) -> Expr {
  const left = parseLogicOr(parser)

  if parser.match(TokenKind.Equal) {
    const value = parseAssignment(parser)
    match left {
      Name(name) => return Expr.Assign(name, value)
      _ => parser.report("Invalid assignment target")
    }
  }

  return left
}

fn parseLogicOr(parser: Parser) -> Expr {
  return parseBinary(parser, parseLogicAnd, [TokenKind.OrOr])
}

fn parseLogicAnd(parser: Parser) -> Expr {
  return parseBinary(parser, parseEquality, [TokenKind.AndAnd])
}

fn parseEquality(parser: Parser) -> Expr {
  return parseBinary(parser, parseComparison, [TokenKind.EqualEqual, TokenKind.BangEqual])
}

fn parseComparison(parser: Parser) -> Expr {
  return parseBinary(parser, parseTerm, [TokenKind.Less, TokenKind.LessEqual, TokenKind.Greater, TokenKind.GreaterEqual])
}

fn parseTerm(parser: Parser) -> Expr {
  return parseBinary(parser, parseFactor, [TokenKind.Plus, TokenKind.Minus])
}

fn parseFactor(parser: Parser) -> Expr {
  return parseBinary(parser, parseUnary, [TokenKind.Star, TokenKind.Slash, TokenKind.Percent])
}

