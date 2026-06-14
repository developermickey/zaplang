package compiler.zap0

enum TypeRef {
  Int
  Bool
  String
  Void
  Named(name: String)
}

struct Program {
  packageName: String
  decls: List<Decl>
}

enum Decl {
  Function(value: FnDecl)
}

struct FnDecl {
  name: String
  params: List<Param>
  returnType: TypeRef
  body: Block
  span: SourceSpan
}

struct Param {
  name: String
  typeRef: TypeRef
}

struct Block {
  statements: List<Stmt>
}

enum Stmt {
  Let(name: String, typeRef: Option<TypeRef>, value: Expr)
  Const(name: String, typeRef: Option<TypeRef>, value: Expr)
  Return(value: Option<Expr>)
  If(condition: Expr, thenBlock: Block, elseBlock: Option<Block>)
  While(condition: Expr, body: Block)
  ExprOnly(value: Expr)
}

enum Expr {
  IntLiteral(value: Int)
  StringLiteral(value: String)
  BoolLiteral(value: Bool)
  Name(value: String)
  Unary(op: UnaryOp, right: Expr)
  Binary(left: Expr, op: BinaryOp, right: Expr)
  Assign(name: String, value: Expr)
  Call(callee: Expr, args: List<Expr>)
}

enum UnaryOp {
  Negate
  Not
}

enum BinaryOp {
  Add
  Subtract
  Multiply
  Divide
  Remainder
  Equal
  NotEqual
  Less
  LessEqual
  Greater
  GreaterEqual
  And
  Or
}

