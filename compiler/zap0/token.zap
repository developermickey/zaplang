package compiler.zap0

enum TokenKind {
  Eof
  Identifier
  IntLiteral
  StringLiteral

  Package
  Fn
  Let
  Const
  Return
  If
  Else
  While
  True
  False

  TypeInt
  TypeBool
  TypeString
  TypeVoid

  Plus
  Minus
  Star
  Slash
  Percent
  Equal
  EqualEqual
  Bang
  BangEqual
  Less
  LessEqual
  Greater
  GreaterEqual
  AndAnd
  OrOr
  Arrow

  LeftParen
  RightParen
  LeftBrace
  RightBrace
  Comma
  Colon
}

struct SourceSpan {
  file: String
  start: Int
  end: Int
  line: Int
  column: Int
}

struct Token {
  kind: TokenKind
  text: String
  span: SourceSpan
}

fn token(kind: TokenKind, text: String, span: SourceSpan) -> Token {
  return Token {
    kind: kind,
    text: text,
    span: span
  }
}

