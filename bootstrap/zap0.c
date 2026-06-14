#include <ctype.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef enum {
  TOK_EOF,
  TOK_IDENTIFIER,
  TOK_INT_LITERAL,
  TOK_STRING_LITERAL,

  TOK_PACKAGE,
  TOK_FN,
  TOK_LET,
  TOK_CONST,
  TOK_RETURN,
  TOK_IF,
  TOK_ELSE,
  TOK_WHILE,
  TOK_TRUE,
  TOK_FALSE,

  TOK_TYPE_INT,
  TOK_TYPE_BOOL,
  TOK_TYPE_STRING,
  TOK_TYPE_VOID,

  TOK_PLUS,
  TOK_MINUS,
  TOK_STAR,
  TOK_SLASH,
  TOK_PERCENT,
  TOK_EQUAL,
  TOK_EQUAL_EQUAL,
  TOK_BANG,
  TOK_BANG_EQUAL,
  TOK_LESS,
  TOK_LESS_EQUAL,
  TOK_GREATER,
  TOK_GREATER_EQUAL,
  TOK_AND_AND,
  TOK_OR_OR,
  TOK_ARROW,

  TOK_LEFT_PAREN,
  TOK_RIGHT_PAREN,
  TOK_LEFT_BRACE,
  TOK_RIGHT_BRACE,
  TOK_COMMA,
  TOK_COLON,

  TOK_ERROR
} TokenKind;

typedef struct {
  TokenKind kind;
  const char *start;
  int length;
  int line;
  int column;
} Token;

typedef struct {
  const char *file;
  const char *source;
  const char *start;
  const char *current;
  int line;
  int column;
  int token_column;
} Lexer;

static const char *token_name(TokenKind kind) {
  switch (kind) {
    case TOK_EOF: return "EOF";
    case TOK_IDENTIFIER: return "Identifier";
    case TOK_INT_LITERAL: return "IntLiteral";
    case TOK_STRING_LITERAL: return "StringLiteral";
    case TOK_PACKAGE: return "package";
    case TOK_FN: return "fn";
    case TOK_LET: return "let";
    case TOK_CONST: return "const";
    case TOK_RETURN: return "return";
    case TOK_IF: return "if";
    case TOK_ELSE: return "else";
    case TOK_WHILE: return "while";
    case TOK_TRUE: return "true";
    case TOK_FALSE: return "false";
    case TOK_TYPE_INT: return "Int";
    case TOK_TYPE_BOOL: return "Bool";
    case TOK_TYPE_STRING: return "String";
    case TOK_TYPE_VOID: return "Void";
    case TOK_PLUS: return "+";
    case TOK_MINUS: return "-";
    case TOK_STAR: return "*";
    case TOK_SLASH: return "/";
    case TOK_PERCENT: return "%";
    case TOK_EQUAL: return "=";
    case TOK_EQUAL_EQUAL: return "==";
    case TOK_BANG: return "!";
    case TOK_BANG_EQUAL: return "!=";
    case TOK_LESS: return "<";
    case TOK_LESS_EQUAL: return "<=";
    case TOK_GREATER: return ">";
    case TOK_GREATER_EQUAL: return ">=";
    case TOK_AND_AND: return "&&";
    case TOK_OR_OR: return "||";
    case TOK_ARROW: return "->";
    case TOK_LEFT_PAREN: return "(";
    case TOK_RIGHT_PAREN: return ")";
    case TOK_LEFT_BRACE: return "{";
    case TOK_RIGHT_BRACE: return "}";
    case TOK_COMMA: return ",";
    case TOK_COLON: return ":";
    case TOK_ERROR: return "Error";
  }
  return "Unknown";
}

static char *read_file(const char *path) {
  FILE *file = fopen(path, "rb");
  if (!file) {
    fprintf(stderr, "zap0: cannot open %s: %s\n", path, strerror(errno));
    return NULL;
  }

  if (fseek(file, 0, SEEK_END) != 0) {
    fprintf(stderr, "zap0: cannot seek %s\n", path);
    fclose(file);
    return NULL;
  }

  long size = ftell(file);
  if (size < 0) {
    fprintf(stderr, "zap0: cannot read size for %s\n", path);
    fclose(file);
    return NULL;
  }

  rewind(file);

  char *buffer = (char *)malloc((size_t)size + 1);
  if (!buffer) {
    fprintf(stderr, "zap0: out of memory\n");
    fclose(file);
    return NULL;
  }

  size_t read = fread(buffer, 1, (size_t)size, file);
  if (read != (size_t)size) {
    fprintf(stderr, "zap0: failed reading %s\n", path);
    free(buffer);
    fclose(file);
    return NULL;
  }

  buffer[size] = '\0';
  fclose(file);
  return buffer;
}

static int is_at_end(Lexer *lexer) {
  return *lexer->current == '\0';
}

static char advance(Lexer *lexer) {
  char ch = *lexer->current++;
  lexer->column++;
  return ch;
}

static char peek(Lexer *lexer) {
  return *lexer->current;
}

static char peek_next(Lexer *lexer) {
  if (is_at_end(lexer)) return '\0';
  return lexer->current[1];
}

static int match(Lexer *lexer, char expected) {
  if (is_at_end(lexer)) return 0;
  if (*lexer->current != expected) return 0;
  lexer->current++;
  lexer->column++;
  return 1;
}

static Token make_token(Lexer *lexer, TokenKind kind) {
  Token token;
  token.kind = kind;
  token.start = lexer->start;
  token.length = (int)(lexer->current - lexer->start);
  token.line = lexer->line;
  token.column = lexer->token_column;
  return token;
}

static Token error_token(Lexer *lexer, const char *message) {
  Token token;
  token.kind = TOK_ERROR;
  token.start = message;
  token.length = (int)strlen(message);
  token.line = lexer->line;
  token.column = lexer->token_column;
  return token;
}

static void skip_line_comment(Lexer *lexer) {
  while (peek(lexer) != '\n' && !is_at_end(lexer)) {
    advance(lexer);
  }
}

static void skip_block_comment(Lexer *lexer) {
  while (!is_at_end(lexer)) {
    if (peek(lexer) == '*' && peek_next(lexer) == '/') {
      advance(lexer);
      advance(lexer);
      return;
    }

    if (peek(lexer) == '\n') {
      advance(lexer);
      lexer->line++;
      lexer->column = 1;
    } else {
      advance(lexer);
    }
  }
}

static void skip_whitespace(Lexer *lexer) {
  for (;;) {
    char ch = peek(lexer);
    switch (ch) {
      case ' ':
      case '\r':
      case '\t':
        advance(lexer);
        break;
      case '\n':
        advance(lexer);
        lexer->line++;
        lexer->column = 1;
        break;
      case '/':
        if (peek_next(lexer) == '/') {
          advance(lexer);
          advance(lexer);
          skip_line_comment(lexer);
        } else if (peek_next(lexer) == '*') {
          advance(lexer);
          advance(lexer);
          skip_block_comment(lexer);
        } else {
          return;
        }
        break;
      default:
        return;
    }
  }
}

static int is_alpha(char ch) {
  return isalpha((unsigned char)ch) || ch == '_';
}

static int is_digit(char ch) {
  return isdigit((unsigned char)ch);
}

static int text_equals(const char *start, int length, const char *text) {
  return (int)strlen(text) == length && memcmp(start, text, (size_t)length) == 0;
}

static TokenKind identifier_kind(const char *start, int length) {
  if (text_equals(start, length, "package")) return TOK_PACKAGE;
  if (text_equals(start, length, "fn")) return TOK_FN;
  if (text_equals(start, length, "let")) return TOK_LET;
  if (text_equals(start, length, "const")) return TOK_CONST;
  if (text_equals(start, length, "return")) return TOK_RETURN;
  if (text_equals(start, length, "if")) return TOK_IF;
  if (text_equals(start, length, "else")) return TOK_ELSE;
  if (text_equals(start, length, "while")) return TOK_WHILE;
  if (text_equals(start, length, "true")) return TOK_TRUE;
  if (text_equals(start, length, "false")) return TOK_FALSE;
  if (text_equals(start, length, "Int")) return TOK_TYPE_INT;
  if (text_equals(start, length, "Bool")) return TOK_TYPE_BOOL;
  if (text_equals(start, length, "String")) return TOK_TYPE_STRING;
  if (text_equals(start, length, "Void")) return TOK_TYPE_VOID;
  return TOK_IDENTIFIER;
}

static Token identifier(Lexer *lexer) {
  while (is_alpha(peek(lexer)) || is_digit(peek(lexer))) {
    advance(lexer);
  }

  int length = (int)(lexer->current - lexer->start);
  return make_token(lexer, identifier_kind(lexer->start, length));
}

static Token number(Lexer *lexer) {
  while (is_digit(peek(lexer))) {
    advance(lexer);
  }

  return make_token(lexer, TOK_INT_LITERAL);
}

static Token string(Lexer *lexer) {
  while (peek(lexer) != '"' && !is_at_end(lexer)) {
    if (peek(lexer) == '\\' && peek_next(lexer) != '\0') {
      advance(lexer);
      advance(lexer);
      continue;
    }

    if (peek(lexer) == '\n') {
      lexer->line++;
      lexer->column = 1;
    }

    advance(lexer);
  }

  if (is_at_end(lexer)) {
    return error_token(lexer, "Unterminated string literal");
  }

  advance(lexer);
  return make_token(lexer, TOK_STRING_LITERAL);
}

static Token next_token(Lexer *lexer) {
  skip_whitespace(lexer);

  lexer->start = lexer->current;
  lexer->token_column = lexer->column;

  if (is_at_end(lexer)) {
    return make_token(lexer, TOK_EOF);
  }

  char ch = advance(lexer);

  if (is_alpha(ch)) return identifier(lexer);
  if (is_digit(ch)) return number(lexer);

  switch (ch) {
    case '(': return make_token(lexer, TOK_LEFT_PAREN);
    case ')': return make_token(lexer, TOK_RIGHT_PAREN);
    case '{': return make_token(lexer, TOK_LEFT_BRACE);
    case '}': return make_token(lexer, TOK_RIGHT_BRACE);
    case ',': return make_token(lexer, TOK_COMMA);
    case ':': return make_token(lexer, TOK_COLON);
    case '+': return make_token(lexer, TOK_PLUS);
    case '*': return make_token(lexer, TOK_STAR);
    case '/': return make_token(lexer, TOK_SLASH);
    case '%': return make_token(lexer, TOK_PERCENT);
    case '-': return make_token(lexer, match(lexer, '>') ? TOK_ARROW : TOK_MINUS);
    case '=': return make_token(lexer, match(lexer, '=') ? TOK_EQUAL_EQUAL : TOK_EQUAL);
    case '!': return make_token(lexer, match(lexer, '=') ? TOK_BANG_EQUAL : TOK_BANG);
    case '<': return make_token(lexer, match(lexer, '=') ? TOK_LESS_EQUAL : TOK_LESS);
    case '>': return make_token(lexer, match(lexer, '=') ? TOK_GREATER_EQUAL : TOK_GREATER);
    case '&':
      if (match(lexer, '&')) return make_token(lexer, TOK_AND_AND);
      return error_token(lexer, "Expected '&' after '&'");
    case '|':
      if (match(lexer, '|')) return make_token(lexer, TOK_OR_OR);
      return error_token(lexer, "Expected '|' after '|'");
    case '"': return string(lexer);
  }

  return error_token(lexer, "Unexpected character");
}

static void print_token(Token token) {
  printf("%4d:%-3d %-14s ", token.line, token.column, token_name(token.kind));

  if (token.kind == TOK_EOF) {
    printf("<eof>\n");
    return;
  }

  printf("'");
  for (int i = 0; i < token.length; i++) {
    char ch = token.start[i];
    if (ch == '\n') {
      printf("\\n");
    } else if (ch == '\t') {
      printf("\\t");
    } else {
      putchar(ch);
    }
  }
  printf("'\n");
}

static int lex_file(const char *path) {
  char *source = read_file(path);
  if (!source) return 1;

  Lexer lexer;
  lexer.file = path;
  lexer.source = source;
  lexer.start = source;
  lexer.current = source;
  lexer.line = 1;
  lexer.column = 1;
  lexer.token_column = 1;

  for (;;) {
    Token token = next_token(&lexer);
    print_token(token);

    if (token.kind == TOK_ERROR) {
      free(source);
      return 1;
    }

    if (token.kind == TOK_EOF) {
      break;
    }
  }

  free(source);
  return 0;
}

typedef struct {
  Token *items;
  int count;
  int capacity;
} TokenArray;

typedef struct {
  Token *tokens;
  int count;
  int current;
  int had_error;
} Parser;

typedef struct Expr Expr;
typedef struct Stmt Stmt;

typedef enum {
  EXPR_INT,
  EXPR_STRING,
  EXPR_BOOL,
  EXPR_NAME,
  EXPR_CALL,
  EXPR_UNARY,
  EXPR_BINARY
} ExprKind;

typedef enum {
  STMT_LET,
  STMT_CONST,
  STMT_RETURN,
  STMT_EXPR,
  STMT_IF,
  STMT_WHILE
} StmtKind;

typedef struct {
  Expr **items;
  int count;
  int capacity;
} ExprArray;

typedef struct {
  Stmt *items;
  int count;
  int capacity;
} StmtArray;

struct Expr {
  ExprKind kind;
  Token token;
  Expr *left;
  Expr *right;
  ExprArray args;
};

struct Stmt {
  StmtKind kind;
  Token name;
  Expr *expr;
  StmtArray then_branch;
  StmtArray else_branch;
  int has_else_branch;
};

typedef struct {
  Token name;
  Token type;
} Param;

typedef struct {
  Param *items;
  int count;
  int capacity;
} ParamArray;

typedef struct {
  Token name;
  Token return_type;
  ParamArray params;
  StmtArray body;
} FnDecl;

typedef struct {
  FnDecl *items;
  int count;
  int capacity;
} FnArray;

typedef struct {
  Token package_name;
  FnArray functions;
} Program;

static void push_token(TokenArray *array, Token token) {
  if (array->count + 1 > array->capacity) {
    int old_capacity = array->capacity;
    array->capacity = old_capacity < 8 ? 8 : old_capacity * 2;
    array->items = (Token *)realloc(array->items, sizeof(Token) * (size_t)array->capacity);
    if (!array->items) {
      fprintf(stderr, "zap0: out of memory\n");
      exit(1);
    }
  }

  array->items[array->count++] = token;
}

static int lex_tokens(const char *path, char **owned_source, TokenArray *tokens) {
  char *source = read_file(path);
  if (!source) return 1;

  Lexer lexer;
  lexer.file = path;
  lexer.source = source;
  lexer.start = source;
  lexer.current = source;
  lexer.line = 1;
  lexer.column = 1;
  lexer.token_column = 1;

  for (;;) {
    Token token = next_token(&lexer);
    push_token(tokens, token);

    if (token.kind == TOK_ERROR) {
      print_token(token);
      free(source);
      return 1;
    }

    if (token.kind == TOK_EOF) {
      break;
    }
  }

  *owned_source = source;
  return 0;
}

static Token *p_peek(Parser *parser) {
  return &parser->tokens[parser->current];
}

static Token *p_previous(Parser *parser) {
  return &parser->tokens[parser->current - 1];
}

static int p_is_at_end(Parser *parser) {
  return p_peek(parser)->kind == TOK_EOF;
}

static Token *p_advance(Parser *parser) {
  if (!p_is_at_end(parser)) parser->current++;
  return p_previous(parser);
}

static int p_check(Parser *parser, TokenKind kind) {
  if (p_is_at_end(parser)) return kind == TOK_EOF;
  return p_peek(parser)->kind == kind;
}

static int p_match(Parser *parser, TokenKind kind) {
  if (!p_check(parser, kind)) return 0;
  p_advance(parser);
  return 1;
}

static void print_indent(int indent) {
  for (int i = 0; i < indent; i++) {
    printf("  ");
  }
}

static void print_token_text(Token token) {
  for (int i = 0; i < token.length; i++) {
    putchar(token.start[i]);
  }
}

static void print_string_value(Token token) {
  int start = 0;
  int end = token.length;

  if (token.length >= 2 && token.start[0] == '"' && token.start[token.length - 1] == '"') {
    start = 1;
    end = token.length - 1;
  }

  for (int i = start; i < end; i++) {
    putchar(token.start[i]);
  }
}

static void parse_error(Parser *parser, const char *message) {
  Token *token = p_peek(parser);
  fprintf(stderr, "zap0: parse error at %d:%d: %s", token->line, token->column, message);
  if (token->kind != TOK_EOF) {
    fprintf(stderr, " near '");
    print_token_text(*token);
    fprintf(stderr, "'");
  }
  fprintf(stderr, "\n");
  parser->had_error = 1;
}

static Token p_consume(Parser *parser, TokenKind kind, const char *message) {
  if (p_check(parser, kind)) return *p_advance(parser);

  parse_error(parser, message);
  Token synthetic = *p_peek(parser);
  synthetic.kind = kind;
  synthetic.length = 0;
  return synthetic;
}

static const char *type_name_from_token(Token token) {
  switch (token.kind) {
    case TOK_TYPE_INT: return "Int";
    case TOK_TYPE_BOOL: return "Bool";
    case TOK_TYPE_STRING: return "String";
    case TOK_TYPE_VOID: return "Void";
    default: return "Unknown";
  }
}

static const char *binary_operator_name(TokenKind kind) {
  switch (kind) {
    case TOK_PLUS: return "+";
    case TOK_MINUS: return "-";
    case TOK_STAR: return "*";
    case TOK_SLASH: return "/";
    case TOK_PERCENT: return "%";
    case TOK_EQUAL_EQUAL: return "==";
    case TOK_BANG_EQUAL: return "!=";
    case TOK_LESS: return "<";
    case TOK_LESS_EQUAL: return "<=";
    case TOK_GREATER: return ">";
    case TOK_GREATER_EQUAL: return ">=";
    case TOK_AND_AND: return "&&";
    case TOK_OR_OR: return "||";
    default: return "?";
  }
}

static void *checked_realloc(void *pointer, size_t size) {
  void *result = realloc(pointer, size);
  if (!result) {
    fprintf(stderr, "zap0: out of memory\n");
    exit(1);
  }
  return result;
}

static Expr *new_expr(ExprKind kind, Token token) {
  Expr *expr = (Expr *)calloc(1, sizeof(Expr));
  if (!expr) {
    fprintf(stderr, "zap0: out of memory\n");
    exit(1);
  }
  expr->kind = kind;
  expr->token = token;
  return expr;
}

static Token synthetic_token(const char *text, TokenKind kind) {
  Token token;
  token.kind = kind;
  token.start = text;
  token.length = (int)strlen(text);
  token.line = 1;
  token.column = 1;
  return token;
}

static void push_expr(ExprArray *array, Expr *expr) {
  if (array->count + 1 > array->capacity) {
    int old_capacity = array->capacity;
    array->capacity = old_capacity < 4 ? 4 : old_capacity * 2;
    array->items = (Expr **)checked_realloc(array->items, sizeof(Expr *) * (size_t)array->capacity);
  }
  array->items[array->count++] = expr;
}

static void push_stmt(StmtArray *array, Stmt stmt) {
  if (array->count + 1 > array->capacity) {
    int old_capacity = array->capacity;
    array->capacity = old_capacity < 4 ? 4 : old_capacity * 2;
    array->items = (Stmt *)checked_realloc(array->items, sizeof(Stmt) * (size_t)array->capacity);
  }
  array->items[array->count++] = stmt;
}

static void push_param(ParamArray *array, Param param) {
  if (array->count + 1 > array->capacity) {
    int old_capacity = array->capacity;
    array->capacity = old_capacity < 4 ? 4 : old_capacity * 2;
    array->items = (Param *)checked_realloc(array->items, sizeof(Param) * (size_t)array->capacity);
  }
  array->items[array->count++] = param;
}

static void push_fn(FnArray *array, FnDecl fn) {
  if (array->count + 1 > array->capacity) {
    int old_capacity = array->capacity;
    array->capacity = old_capacity < 4 ? 4 : old_capacity * 2;
    array->items = (FnDecl *)checked_realloc(array->items, sizeof(FnDecl) * (size_t)array->capacity);
  }
  array->items[array->count++] = fn;
}

static Expr *parse_expression(Parser *parser);

static int token_is_type(TokenKind kind) {
  return kind == TOK_TYPE_INT || kind == TOK_TYPE_BOOL || kind == TOK_TYPE_STRING || kind == TOK_TYPE_VOID;
}

static Token parse_type(Parser *parser) {
  if (token_is_type(p_peek(parser)->kind)) return *p_advance(parser);
  return p_consume(parser, TOK_TYPE_INT, "expected type");
}

static Expr *parse_primary(Parser *parser) {
  if (p_match(parser, TOK_INT_LITERAL)) {
    return new_expr(EXPR_INT, *p_previous(parser));
  }

  if (p_match(parser, TOK_STRING_LITERAL)) {
    return new_expr(EXPR_STRING, *p_previous(parser));
  }

  if (p_match(parser, TOK_TRUE) || p_match(parser, TOK_FALSE)) {
    return new_expr(EXPR_BOOL, *p_previous(parser));
  }

  if (p_match(parser, TOK_IDENTIFIER)) {
    return new_expr(EXPR_NAME, *p_previous(parser));
  }

  if (p_match(parser, TOK_LEFT_PAREN)) {
    Expr *expr = parse_expression(parser);
    p_consume(parser, TOK_RIGHT_PAREN, "expected ')' after expression");
    return expr;
  }

  parse_error(parser, "expected expression");
  if (!p_is_at_end(parser)) p_advance(parser);
  return new_expr(EXPR_NAME, synthetic_token("<error>", TOK_IDENTIFIER));
}

static Expr *parse_call(Parser *parser) {
  Expr *expr = parse_primary(parser);

  while (p_match(parser, TOK_LEFT_PAREN)) {
    Expr *call = new_expr(EXPR_CALL, expr->token);
    call->left = expr;

    if (!p_check(parser, TOK_RIGHT_PAREN)) {
      do {
        push_expr(&call->args, parse_expression(parser));
      } while (p_match(parser, TOK_COMMA));
    }

    p_consume(parser, TOK_RIGHT_PAREN, "expected ')' after arguments");
    expr = call;
  }

  return expr;
}

static Expr *parse_unary(Parser *parser) {
  if (p_match(parser, TOK_BANG) || p_match(parser, TOK_MINUS)) {
    Token op = *p_previous(parser);
    Expr *expr = new_expr(EXPR_UNARY, op);
    expr->right = parse_unary(parser);
    return expr;
  }

  return parse_call(parser);
}

static Expr *parse_factor(Parser *parser) {
  Expr *expr = parse_unary(parser);

  while (p_match(parser, TOK_STAR) || p_match(parser, TOK_SLASH) || p_match(parser, TOK_PERCENT)) {
    Token op = *p_previous(parser);
    Expr *binary = new_expr(EXPR_BINARY, op);
    binary->left = expr;
    binary->right = parse_unary(parser);
    expr = binary;
  }

  return expr;
}

static Expr *parse_term(Parser *parser) {
  Expr *expr = parse_factor(parser);

  while (p_match(parser, TOK_PLUS) || p_match(parser, TOK_MINUS)) {
    Token op = *p_previous(parser);
    Expr *binary = new_expr(EXPR_BINARY, op);
    binary->left = expr;
    binary->right = parse_factor(parser);
    expr = binary;
  }

  return expr;
}

static Expr *parse_comparison(Parser *parser) {
  Expr *expr = parse_term(parser);

  while (
      p_match(parser, TOK_LESS) ||
      p_match(parser, TOK_LESS_EQUAL) ||
      p_match(parser, TOK_GREATER) ||
      p_match(parser, TOK_GREATER_EQUAL)) {
    Token op = *p_previous(parser);
    Expr *binary = new_expr(EXPR_BINARY, op);
    binary->left = expr;
    binary->right = parse_term(parser);
    expr = binary;
  }

  return expr;
}

static Expr *parse_equality(Parser *parser) {
  Expr *expr = parse_comparison(parser);

  while (p_match(parser, TOK_EQUAL_EQUAL) || p_match(parser, TOK_BANG_EQUAL)) {
    Token op = *p_previous(parser);
    Expr *binary = new_expr(EXPR_BINARY, op);
    binary->left = expr;
    binary->right = parse_comparison(parser);
    expr = binary;
  }

  return expr;
}

static Expr *parse_expression(Parser *parser) {
  return parse_equality(parser);
}

static StmtArray parse_block(Parser *parser);

static Stmt parse_statement(Parser *parser) {
  Stmt stmt;
  memset(&stmt, 0, sizeof(stmt));

  if (p_match(parser, TOK_LET) || p_match(parser, TOK_CONST)) {
    TokenKind binding_kind = p_previous(parser)->kind;
    stmt.kind = binding_kind == TOK_CONST ? STMT_CONST : STMT_LET;
    stmt.name = p_consume(parser, TOK_IDENTIFIER, "expected binding name");

    if (p_match(parser, TOK_COLON)) {
      parse_type(parser);
    }

    p_consume(parser, TOK_EQUAL, "expected '=' after binding name");
    stmt.expr = parse_expression(parser);
    return stmt;
  }

  if (p_match(parser, TOK_RETURN)) {
    stmt.kind = STMT_RETURN;

    if (!p_check(parser, TOK_RIGHT_BRACE) && !p_check(parser, TOK_EOF)) {
      stmt.expr = parse_expression(parser);
    }
    return stmt;
  }

  if (p_match(parser, TOK_IF)) {
    stmt.kind = STMT_IF;
    stmt.expr = parse_expression(parser);
    stmt.then_branch = parse_block(parser);

    if (p_match(parser, TOK_ELSE)) {
      stmt.has_else_branch = 1;
      stmt.else_branch = parse_block(parser);
    }
    return stmt;
  }

  if (p_match(parser, TOK_WHILE)) {
    stmt.kind = STMT_WHILE;
    stmt.expr = parse_expression(parser);
    stmt.then_branch = parse_block(parser);
    return stmt;
  }

  stmt.kind = STMT_EXPR;
  stmt.expr = parse_expression(parser);
  return stmt;
}

static StmtArray parse_block(Parser *parser) {
  StmtArray statements;
  memset(&statements, 0, sizeof(statements));

  p_consume(parser, TOK_LEFT_BRACE, "expected '{' before block");

  while (!p_check(parser, TOK_RIGHT_BRACE) && !p_is_at_end(parser)) {
    push_stmt(&statements, parse_statement(parser));
  }

  p_consume(parser, TOK_RIGHT_BRACE, "expected '}' after block");
  return statements;
}

static FnDecl parse_function(Parser *parser) {
  FnDecl fn;
  memset(&fn, 0, sizeof(fn));

  p_consume(parser, TOK_FN, "expected function declaration");
  fn.name = p_consume(parser, TOK_IDENTIFIER, "expected function name");

  p_consume(parser, TOK_LEFT_PAREN, "expected '(' after function name");
  if (!p_check(parser, TOK_RIGHT_PAREN)) {
    do {
      Param param;
      param.name = p_consume(parser, TOK_IDENTIFIER, "expected parameter name");
      p_consume(parser, TOK_COLON, "expected ':' after parameter name");
      param.type = parse_type(parser);
      push_param(&fn.params, param);
    } while (p_match(parser, TOK_COMMA));
  }
  p_consume(parser, TOK_RIGHT_PAREN, "expected ')' after parameters");

  fn.return_type = synthetic_token("Void", TOK_TYPE_VOID);
  if (p_match(parser, TOK_ARROW)) {
    fn.return_type = parse_type(parser);
  }

  fn.body = parse_block(parser);
  return fn;
}

static Program parse_program(Parser *parser) {
  Program program;
  memset(&program, 0, sizeof(program));
  program.package_name = synthetic_token("main", TOK_IDENTIFIER);

  if (p_match(parser, TOK_PACKAGE)) {
    program.package_name = p_consume(parser, TOK_IDENTIFIER, "expected package name");
  }

  while (!p_is_at_end(parser)) {
    push_fn(&program.functions, parse_function(parser));
  }

  return program;
}

static void print_expr(Expr *expr, int indent) {
  if (!expr) return;

  switch (expr->kind) {
    case EXPR_INT:
      print_indent(indent);
      printf("Int ");
      print_token_text(expr->token);
      printf("\n");
      break;
    case EXPR_STRING:
      print_indent(indent);
      printf("String \"");
      print_string_value(expr->token);
      printf("\"\n");
      break;
    case EXPR_BOOL:
      print_indent(indent);
      printf("Bool ");
      print_token_text(expr->token);
      printf("\n");
      break;
    case EXPR_NAME:
      print_indent(indent);
      printf("Name ");
      print_token_text(expr->token);
      printf("\n");
      break;
    case EXPR_CALL:
      print_indent(indent);
      printf("Call ");
      print_token_text(expr->left->token);
      printf("\n");
      for (int i = 0; i < expr->args.count; i++) {
        print_expr(expr->args.items[i], indent + 1);
      }
      break;
    case EXPR_UNARY:
      print_indent(indent);
      printf("Unary %s\n", binary_operator_name(expr->token.kind));
      print_expr(expr->right, indent + 1);
      break;
    case EXPR_BINARY:
      print_indent(indent);
      printf("Binary %s\n", binary_operator_name(expr->token.kind));
      print_expr(expr->left, indent + 1);
      print_expr(expr->right, indent + 1);
      break;
  }
}

static void print_statements(StmtArray statements, int indent);

static void print_stmt(Stmt stmt, int indent) {
  switch (stmt.kind) {
    case STMT_LET:
    case STMT_CONST:
      print_indent(indent);
      printf("%s ", stmt.kind == STMT_CONST ? "Const" : "Let");
      print_token_text(stmt.name);
      printf("\n");
      print_expr(stmt.expr, indent + 1);
      break;
    case STMT_RETURN:
      print_indent(indent);
      printf("Return\n");
      print_expr(stmt.expr, indent + 1);
      break;
    case STMT_EXPR:
      print_expr(stmt.expr, indent);
      break;
    case STMT_IF:
      print_indent(indent);
      printf("If\n");
      print_indent(indent + 1);
      printf("Condition\n");
      print_expr(stmt.expr, indent + 2);
      print_indent(indent + 1);
      printf("Then\n");
      print_statements(stmt.then_branch, indent + 2);
      if (stmt.has_else_branch) {
        print_indent(indent + 1);
        printf("Else\n");
        print_statements(stmt.else_branch, indent + 2);
      }
      break;
    case STMT_WHILE:
      print_indent(indent);
      printf("While\n");
      print_indent(indent + 1);
      printf("Condition\n");
      print_expr(stmt.expr, indent + 2);
      print_indent(indent + 1);
      printf("Body\n");
      print_statements(stmt.then_branch, indent + 2);
      break;
  }
}

static void print_statements(StmtArray statements, int indent) {
  for (int i = 0; i < statements.count; i++) {
    print_stmt(statements.items[i], indent);
  }
}

static void print_program(Program program) {
  printf("Program package=");
  print_token_text(program.package_name);
  printf("\n");

  for (int i = 0; i < program.functions.count; i++) {
    FnDecl fn = program.functions.items[i];
    printf("  Fn ");
    print_token_text(fn.name);
    printf("(");

    for (int param_index = 0; param_index < fn.params.count; param_index++) {
      if (param_index > 0) printf(", ");
      Param param = fn.params.items[param_index];
      print_token_text(param.name);
      printf(": %s", type_name_from_token(param.type));
    }

    printf(") -> %s\n", type_name_from_token(fn.return_type));
    print_statements(fn.body, 2);
    printf("\n");
  }
}

static int ast_file(const char *path) {
  char *source = NULL;
  TokenArray tokens;
  tokens.items = NULL;
  tokens.count = 0;
  tokens.capacity = 0;

  if (lex_tokens(path, &source, &tokens) != 0) {
    free(tokens.items);
    return 1;
  }

  Parser parser;
  parser.tokens = tokens.items;
  parser.count = tokens.count;
  parser.current = 0;
  parser.had_error = 0;

  Program program = parse_program(&parser);
  print_program(program);

  int result = parser.had_error ? 1 : 0;
  free(tokens.items);
  free(source);
  return result;
}

static void usage(void) {
  fprintf(stderr, "usage:\n");
  fprintf(stderr, "  zap0 tokens <file.zap>\n");
  fprintf(stderr, "  zap0 ast <file.zap>\n");
}

int main(int argc, char **argv) {
  if (argc != 3) {
    usage();
    return 1;
  }

  if (strcmp(argv[1], "tokens") == 0) {
    return lex_file(argv[2]);
  }

  if (strcmp(argv[1], "ast") == 0) {
    return ast_file(argv[2]);
  }

  usage();
  return 1;
}
