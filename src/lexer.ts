export type TokenType =
  | "LET" | "FN" | "IF" | "ELSE" | "LOOP" | "FROM" | "TO" | "WHILE"
  | "RETURN" | "BREAK" | "CONTINUE"
  | "TRY" | "CATCH" | "FINALLY"
  | "IMPORT" | "AS" | "EXPORT"
  | "SERVER" | "ON" | "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  | "TRUE" | "FALSE" | "NULL"
  | "AND" | "OR" | "NOT"
  | "PLUSEQ" | "MINUSEQ" | "STAREQ" | "SLASHEQ"
  | "PLUSPLUS" | "MINUSMINUS"
  | "NUMBER" | "STRING" | "TEMPLATE" | "IDENT"
  | "PLUS" | "MINUS" | "STAR" | "SLASH" | "PERCENT" | "POWER"
  | "EQ" | "EQEQ" | "NEQ" | "LT" | "GT" | "LTE" | "GTE"
  | "LPAREN" | "RPAREN" | "LBRACE" | "RBRACE" | "LBRACKET" | "RBRACKET"
  | "COMMA" | "DOT" | "ARROW" | "COLON" | "QUESTION" | "SEMICOLON"
  | "EOF"

export interface Token {
  type: TokenType
  value: string
  line: number
}

const KEYWORDS: Record<string, TokenType> = {
  let: "LET", fn: "FN", if: "IF", else: "ELSE",
  loop: "LOOP", from: "FROM", to: "TO", while: "WHILE",
  return: "RETURN", break: "BREAK", continue: "CONTINUE",
  try: "TRY", catch: "CATCH", finally: "FINALLY",
  import: "IMPORT", as: "AS", export: "EXPORT",
  server: "SERVER", on: "ON",
  get: "GET", post: "POST", put: "PUT", delete: "DELETE", patch: "PATCH",
  true: "TRUE", false: "FALSE", null: "NULL",
  and: "AND", or: "OR", not: "NOT",
}

export function lex(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1

  while (i < source.length) {
    // Whitespace
    if (source[i] === " " || source[i] === "\t" || source[i] === "\r") { i++; continue }

    // Newline
    if (source[i] === "\n") { line++; i++; continue }

    // Line comments //
    if (source[i] === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++
      continue
    }

    // Block comments /* */
    if (source[i] === "/" && source[i + 1] === "*") {
      i += 2
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line++
        i++
      }
      i += 2
      continue
    }

    // Numbers (int and float)
    if (/[0-9]/.test(source[i])) {
      let num = ""
      while (i < source.length && /[0-9.]/.test(source[i])) num += source[i++]
      tokens.push({ type: "NUMBER", value: num, line })
      continue
    }

    // Template strings `Hello {name}`
    if (source[i] === "`") {
      i++
      let str = ""
      while (i < source.length && source[i] !== "`") {
        if (source[i] === "\n") { line++; str += "\\n"; i++; continue }
        str += source[i++]
      }
      i++ // closing backtick
      tokens.push({ type: "TEMPLATE", value: str, line })
      continue
    }

    // Regular strings
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i++]
      let str = ""
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\" && i + 1 < source.length) {
          i++
          switch (source[i]) {
            case "n": str += "\n"; break
            case "t": str += "\t"; break
            case "r": str += "\r"; break
            case '"': str += '"'; break
            case "'": str += "'"; break
            case "\\": str += "\\"; break
            default: str += "\\" + source[i]
          }
          i++
        } else {
          if (source[i] === "\n") line++
          str += source[i++]
        }
      }
      i++ // closing quote
      tokens.push({ type: "STRING", value: str, line })
      continue
    }

    // Identifiers & keywords
    if (/[a-zA-Z_$]/.test(source[i])) {
      let ident = ""
      while (i < source.length && /[a-zA-Z0-9_$]/.test(source[i])) ident += source[i++]
      tokens.push({ type: KEYWORDS[ident] ?? "IDENT", value: ident, line })
      continue
    }

    // Three-char operators
    const three = source[i] + (source[i+1] ?? "") + (source[i+2] ?? "")
    if (three === "**=") { tokens.push({ type: "STAREQ", value: "**=", line }); i += 3; continue }

    // Two-char operators
    const two = source[i] + (source[i + 1] ?? "")
    if (two === "==") { tokens.push({ type: "EQEQ",     value: "==", line }); i += 2; continue }
    if (two === "!=") { tokens.push({ type: "NEQ",      value: "!=", line }); i += 2; continue }
    if (two === "<=") { tokens.push({ type: "LTE",      value: "<=", line }); i += 2; continue }
    if (two === ">=") { tokens.push({ type: "GTE",      value: ">=", line }); i += 2; continue }
    if (two === "->") { tokens.push({ type: "ARROW",    value: "->", line }); i += 2; continue }
    if (two === "&&") { tokens.push({ type: "AND",      value: "&&", line }); i += 2; continue }
    if (two === "||") { tokens.push({ type: "OR",       value: "||", line }); i += 2; continue }
    if (two === "+=") { tokens.push({ type: "PLUSEQ",   value: "+=", line }); i += 2; continue }
    if (two === "-=") { tokens.push({ type: "MINUSEQ",  value: "-=", line }); i += 2; continue }
    if (two === "*=") { tokens.push({ type: "STAREQ",   value: "*=", line }); i += 2; continue }
    if (two === "/=") { tokens.push({ type: "SLASHEQ",  value: "/=", line }); i += 2; continue }
    if (two === "++") { tokens.push({ type: "PLUSPLUS",     value: "++", line }); i += 2; continue }
    if (two === "--") { tokens.push({ type: "MINUSMINUS",   value: "--", line }); i += 2; continue }
    if (two === "**") { tokens.push({ type: "POWER",    value: "**", line }); i += 2; continue }

    // Single-char
    const singles: Partial<Record<string, TokenType>> = {
      "=": "EQ", "+": "PLUS", "-": "MINUS", "*": "STAR", "/": "SLASH", "%": "PERCENT",
      "<": "LT", ">": "GT",
      "(": "LPAREN", ")": "RPAREN",
      "{": "LBRACE", "}": "RBRACE",
      "[": "LBRACKET", "]": "RBRACKET",
      ",": "COMMA", ".": "DOT", ":": "COLON", "!": "NOT",
      "?": "QUESTION", ";": "SEMICOLON",
    }
    if (singles[source[i]]) {
      tokens.push({ type: singles[source[i]]!, value: source[i], line })
      i++
      continue
    }

    i++ // skip unknown char
  }

  tokens.push({ type: "EOF", value: "", line })
  return tokens
}
