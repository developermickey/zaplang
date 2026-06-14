# Zap v0 Native Grammar

This document freezes the first native compiler subset. Zap v0 exists only to compile small command-line programs and bootstrap the future compiler.

## Supported Example

```zap
package main

fn add(a: Int, b: Int) -> Int {
  return a + b
}

fn main() -> Int {
  let result = add(20, 22)
  print(result)
  return 0
}
```

## Tokens

Keywords:

```text
package fn let const return if else while true false
```

Primitive types:

```text
Int Bool String Void
```

Operators:

```text
+ - * / % == != < <= > >= = && || !
```

Punctuation:

```text
( ) { } , : ->
```

Literals:

```text
integer string boolean
```

## Grammar

```ebnf
program       = package_decl? declaration* EOF ;

package_decl  = "package" identifier ;

declaration   = function_decl ;

function_decl = "fn" identifier "(" params? ")" return_type? block ;
params        = param ("," param)* ;
param         = identifier ":" type ;
return_type   = "->" type ;

type          = "Int" | "Bool" | "String" | "Void" | identifier ;

block         = "{" statement* "}" ;

statement     = let_stmt
              | const_stmt
              | return_stmt
              | if_stmt
              | while_stmt
              | expr_stmt ;

let_stmt      = "let" identifier type_annotation? "=" expression ;
const_stmt    = "const" identifier type_annotation? "=" expression ;
type_annotation = ":" type ;
return_stmt   = "return" expression? ;
if_stmt       = "if" expression block ("else" block)? ;
while_stmt    = "while" expression block ;
expr_stmt     = expression ;

expression    = assignment ;
assignment    = logic_or ("=" assignment)? ;
logic_or      = logic_and ("||" logic_and)* ;
logic_and     = equality ("&&" equality)* ;
equality      = comparison (("==" | "!=") comparison)* ;
comparison    = term (("<" | "<=" | ">" | ">=") term)* ;
term          = factor (("+" | "-") factor)* ;
factor        = unary (("*" | "/" | "%") unary)* ;
unary         = ("!" | "-") unary | call ;
call          = primary ("(" arguments? ")")* ;
arguments     = expression ("," expression)* ;
primary       = integer | string | boolean | identifier | "(" expression ")" ;
```

## v0 Rules

- Every executable package must define `fn main() -> Int`.
- Public/private visibility is deferred.
- Classes, structs, interfaces, generics, async, pattern matching, web, and desktop are deferred.
- v0 codegen may target one platform first.
- v0 runtime only needs `print`, process exit, strings, and integer arithmetic.

