# Contributing to Zap Language

Thank you for your interest in contributing! Zap is an open-source project and we welcome all contributions.

## How to Contribute

### 1. Fork the Repository
Click the **Fork** button on GitHub to create your own copy.

### 2. Clone Your Fork
```bash
git clone https://github.com/YOUR_USERNAME/zaplang.git
cd zaplang
npm install
npm run build
```

### 3. Create a Branch
```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/my-bugfix
```

### 4. Make Your Changes

Project structure:
```
src/
├── lexer.ts        ← Tokenizer (text → tokens)
├── parser.ts       ← Parser (tokens → AST)
├── transpiler.ts   ← Code generator (AST → JavaScript)
└── cli.ts          ← Command-line interface
examples/
├── hello.zp        ← Basic language features
└── server.zp       ← Web server example
```

### 5. Test Your Changes
```bash
npm run build
node dist/cli.js run examples/hello.zp
node dist/cli.js run examples/server.zp
```

### 6. Commit and Push
```bash
git add .
git commit -m "feat: describe your change"
git push origin feature/my-feature
```

### 7. Open a Pull Request
Go to GitHub and open a Pull Request against the `main` branch.

## Commit Message Format

| Prefix | Use for |
|--------|---------|
| `feat:` | New language feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `refactor:` | Code cleanup |
| `example:` | New example file |

## Ideas for Contributions

- New built-in functions (`split`, `join`, `keys`, `values`, `range`)
- `while` loop support
- String interpolation: `"Hello {name}"`
- Type annotations: `let name: string = "Murph"`
- Error handling: `try / catch`
- Import system: `import "math"`
- More HTTP methods (PUT, DELETE, PATCH)
- VS Code syntax highlighting extension
- Package manager for Zap libraries

## Code of Conduct

Be kind, respectful, and constructive. Everyone is welcome.

---

**Founder:** Mukesh Pathak — MurphTech Software Solutions
