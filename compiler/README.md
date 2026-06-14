# Zap Native Compiler

This directory is the start of the real Zap toolchain.

The existing TypeScript code in `src/` is an early prototype. The long-term compiler belongs here and should become a Go-style native toolchain:

```text
.zap source
  -> lexer
  -> parser
  -> typed AST
  -> Zap IR
  -> native object file
  -> Zap linker
  -> native executable
```

## Current Contents

- `zap0/`: first compiler skeleton
- `runtime/`: minimal native runtime contracts
- `tests/`: first v0 smoke programs

## First Milestone

Build the temporary bootstrap lexer:

```bash
cc -std=c11 -Wall -Wextra -Werror bootstrap/zap0.c -o bootstrap/zap0
```

Tokenize the first native smoke test:

```bash
bootstrap/zap0 tokens compiler/tests/hello_native.zap
```

Print the first parsed AST:

```bash
bootstrap/zap0 ast compiler/tests/hello_native.zap
```

Later, this command should compile and run:

```bash
zap0 build compiler/tests/hello_native.zap -o hello
./hello
```

Expected output:

```text
Hello from native Zap
42
```

## v0 Scope

Zap v0 intentionally supports only:

- `package`
- `fn`
- `let`
- `const`
- `return`
- `if`
- `else`
- `while`
- `Int`
- `Bool`
- `String`
- function calls
- `print`

Everything else waits until this tiny compiler is real.
