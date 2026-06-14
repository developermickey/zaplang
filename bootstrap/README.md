# Zap Bootstrap Compiler

`zap0.c` is the temporary bootstrap compiler for Zap.

This file is allowed to be written in C only because Zap cannot compile itself yet. The long-term goal is to replace it with a Zap compiler written in Zap.

## Current Milestone

The first milestone is a real lexer:

```bash
cc -std=c11 -Wall -Wextra -Werror bootstrap/zap0.c -o bootstrap/zap0
bootstrap/zap0 tokens compiler/tests/hello_native.zap
```

The command prints token kind, source location, and lexeme text.

## Next Milestone

Parser mode is now available:

```bash
bootstrap/zap0 ast compiler/tests/hello_native.zap
```

It parses packages, functions, parameters, `let`, `return`, calls, literals, and basic binary operators.

Next:

- type-check `main`
- generate one native executable target
