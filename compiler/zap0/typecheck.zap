package compiler.zap0

struct Symbol {
  name: String
  typeRef: TypeRef
  mutable: Bool
}

struct Scope {
  symbols: Map<String, Symbol>
}

struct CheckedProgram {
  program: Program
}

fn typecheck(program: Program) -> Result<CheckedProgram, Diagnostics> {
  let diagnostics = diagnostics()

  validateMain(program, diagnostics)

  for decl in program.decls {
    match decl {
      Function(fnDecl) => checkFunction(fnDecl, diagnostics)
    }
  }

  if diagnostics.items.len > 0 {
    return err(diagnostics)
  }

  return ok(CheckedProgram {
    program: program
  })
}

fn validateMain(program: Program, diagnostics: Diagnostics) {
  let found = false

  for decl in program.decls {
    match decl {
      Function(fnDecl) => {
        if fnDecl.name == "main" {
          found = true
          if fnDecl.params.len != 0 {
            diagnostics.items.push(error("main must not accept parameters", fnDecl.span))
          }
          if fnDecl.returnType != TypeRef.Int {
            diagnostics.items.push(error("main must return Int in Zap v0", fnDecl.span))
          }
        }
      }
    }
  }

  if !found {
    diagnostics.items.push(error("Executable package must define fn main() -> Int", emptySpan()))
  }
}

fn checkFunction(fnDecl: FnDecl, diagnostics: Diagnostics) {
  let scope = Scope {
    symbols: Map<String, Symbol>()
  }

  for param in fnDecl.params {
    scope.symbols.set(param.name, Symbol {
      name: param.name,
      typeRef: param.typeRef,
      mutable: false
    })
  }

  checkBlock(fnDecl.body, fnDecl.returnType, scope, diagnostics)
}

fn checkBlock(block: Block, returnType: TypeRef, scope: Scope, diagnostics: Diagnostics) {
  for statement in block.statements {
    checkStatement(statement, returnType, scope, diagnostics)
  }
}

fn checkStatement(statement: Stmt, returnType: TypeRef, scope: Scope, diagnostics: Diagnostics) {
  match statement {
    Let(name, explicitType, value) => {
      const valueType = checkExpr(value, scope, diagnostics)
      const bindingType = explicitType.unwrapOr(valueType)
      scope.symbols.set(name, Symbol { name: name, typeRef: bindingType, mutable: true })
    }
    Const(name, explicitType, value) => {
      const valueType = checkExpr(value, scope, diagnostics)
      const bindingType = explicitType.unwrapOr(valueType)
      scope.symbols.set(name, Symbol { name: name, typeRef: bindingType, mutable: false })
    }
    Return(value) => {
      if value.isNone() && returnType != TypeRef.Void {
        diagnostics.items.push(error("Return value required", emptySpan()))
      }
    }
    If(condition, thenBlock, elseBlock) => {
      const conditionType = checkExpr(condition, scope, diagnostics)
      if conditionType != TypeRef.Bool {
        diagnostics.items.push(error("if condition must be Bool", emptySpan()))
      }
      checkBlock(thenBlock, returnType, scope, diagnostics)
      if elseBlock.isSome() {
        checkBlock(elseBlock.unwrap(), returnType, scope, diagnostics)
      }
    }
    While(condition, body) => {
      const conditionType = checkExpr(condition, scope, diagnostics)
      if conditionType != TypeRef.Bool {
        diagnostics.items.push(error("while condition must be Bool", emptySpan()))
      }
      checkBlock(body, returnType, scope, diagnostics)
    }
    ExprOnly(value) => {
      checkExpr(value, scope, diagnostics)
    }
  }
}

fn checkExpr(expr: Expr, scope: Scope, diagnostics: Diagnostics) -> TypeRef {
  match expr {
    IntLiteral(_) => return TypeRef.Int
    StringLiteral(_) => return TypeRef.String
    BoolLiteral(_) => return TypeRef.Bool
    Name(name) => {
      if scope.symbols.has(name) {
        return scope.symbols.get(name).typeRef
      }
      diagnostics.items.push(error("Unknown name '{name}'", emptySpan()))
      return TypeRef.Int
    }
    _ => return TypeRef.Int
  }
}

