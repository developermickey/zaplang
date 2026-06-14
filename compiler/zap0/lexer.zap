package compiler.zap0

struct Lexer {
  file: String
  source: String
  start: Int
  current: Int
  line: Int
  column: Int
  tokens: List<Token>
  diagnostics: Diagnostics
}

fn lex(file: String, source: String) -> Result<List<Token>, Diagnostics> {
  let lexer = Lexer {
    file: file,
    source: source,
    start: 0,
    current: 0,
    line: 1,
    column: 1,
    tokens: List<Token>(),
    diagnostics: diagnostics()
  }

  while !lexer.isAtEnd() {
    lexer.start = lexer.current
    scanToken(lexer)
  }

  lexer.tokens.push(token(TokenKind.Eof, "", lexer.span()))

  if lexer.diagnostics.items.len > 0 {
    return err(lexer.diagnostics)
  }

  return ok(lexer.tokens)
}

fn scanToken(lexer: Lexer) {
  const ch = lexer.advance()

  match ch {
    "(" => lexer.add(TokenKind.LeftParen)
    ")" => lexer.add(TokenKind.RightParen)
    "{" => lexer.add(TokenKind.LeftBrace)
    "}" => lexer.add(TokenKind.RightBrace)
    "," => lexer.add(TokenKind.Comma)
    ":" => lexer.add(TokenKind.Colon)
    "+" => lexer.add(TokenKind.Plus)
    "*" => lexer.add(TokenKind.Star)
    "%" => lexer.add(TokenKind.Percent)
    "-" => {
      if lexer.match(">") {
        lexer.add(TokenKind.Arrow)
      } else {
        lexer.add(TokenKind.Minus)
      }
    }
    "/" => {
      if lexer.match("/") {
        lexer.skipLineComment()
      } else {
        lexer.add(TokenKind.Slash)
      }
    }
    "!" => lexer.add(if lexer.match("=") { TokenKind.BangEqual } else { TokenKind.Bang })
    "=" => lexer.add(if lexer.match("=") { TokenKind.EqualEqual } else { TokenKind.Equal })
    "<" => lexer.add(if lexer.match("=") { TokenKind.LessEqual } else { TokenKind.Less })
    ">" => lexer.add(if lexer.match("=") { TokenKind.GreaterEqual } else { TokenKind.Greater })
    "&" => {
      if lexer.match("&") {
        lexer.add(TokenKind.AndAnd)
      } else {
        lexer.report("Expected '&' after '&'")
      }
    }
    "|" => {
      if lexer.match("|") {
        lexer.add(TokenKind.OrOr)
      } else {
        lexer.report("Expected '|' after '|'")
      }
    }
    " " => {}
    "\r" => {}
    "\t" => {}
    "\n" => lexer.newLine()
    "\"" => lexer.string()
    _ => {
      if isDigit(ch) {
        lexer.number()
      } else if isAlpha(ch) {
        lexer.identifier()
      } else {
        lexer.report("Unexpected character '{ch}'")
      }
    }
  }
}

fn keywordKind(text: String) -> TokenKind {
  match text {
    "package" => TokenKind.Package
    "fn" => TokenKind.Fn
    "let" => TokenKind.Let
    "const" => TokenKind.Const
    "return" => TokenKind.Return
    "if" => TokenKind.If
    "else" => TokenKind.Else
    "while" => TokenKind.While
    "true" => TokenKind.True
    "false" => TokenKind.False
    "Int" => TokenKind.TypeInt
    "Bool" => TokenKind.TypeBool
    "String" => TokenKind.TypeString
    "Void" => TokenKind.TypeVoid
    _ => TokenKind.Identifier
  }
}

fn isDigit(ch: String) -> Bool {
  return ch >= "0" && ch <= "9"
}

fn isAlpha(ch: String) -> Bool {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch == "_"
}

fn isAlphaNumeric(ch: String) -> Bool {
  return isAlpha(ch) || isDigit(ch)
}

