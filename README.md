# Zap Language

> A simple, fast native programming language for building full-stack web apps, desktop apps, APIs, CLI tools, and native binaries.
> Files use `.zap` or `.zp` extension.

Created by **Mukesh Pathak** — Founder, MurphTech Software Solutions

---

## Language Specification

Zap's full native-language architecture draft is available in [`docs/ZAP_LANGUAGE_SPEC.md`](docs/ZAP_LANGUAGE_SPEC.md). It covers the language design, compiler pipeline, runtime, package manager, ZapWeb, ZapDesk, CLI, examples, roadmap, and editor icon assets.

Zap's Go-style native bootstrap plan is available in [`docs/NATIVE_BOOTSTRAP_PLAN.md`](docs/NATIVE_BOOTSTRAP_PLAN.md). This is the path from prototype to a self-contained compiler that produces native binaries without depending on JavaScript, Node.js, Python, Go, Java, PHP, Rust, or another language runtime.

The first native compiler skeleton is in [`compiler`](compiler), and the frozen v0 grammar is in [`docs/ZAP_V0_GRAMMAR.md`](docs/ZAP_V0_GRAMMAR.md).

The temporary native bootstrap compiler starts in [`bootstrap/zap0.c`](bootstrap/zap0.c). Build and run the first lexer milestone with:

```bash
cc -std=c11 -Wall -Wextra -Werror bootstrap/zap0.c -o bootstrap/zap0
bootstrap/zap0 tokens compiler/tests/hello_native.zap
```

Editor-ready icons are available in [`assets/icons`](assets/icons), with a VS Code icon theme manifest at [`editor/zap-icon-theme.json`](editor/zap-icon-theme.json).

Syntax highlighting files are available in [`editor/syntaxes/zap.tmLanguage.json`](editor/syntaxes/zap.tmLanguage.json), with language configuration in [`editor/language-configuration.json`](editor/language-configuration.json).

---

## Contributors

Thanks to these wonderful people who built Zap:

<!-- ALL-CONTRIBUTORS-LIST:START -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%">
        <a href="https://github.com/developermickey">
          <img src="https://avatars.githubusercontent.com/developermickey?v=4" width="100px;" alt="Mukesh Pathak"/><br/>
          <sub><b>Mukesh Pathak</b></sub>
        </a><br/>
        <a title="Code">💻</a>
        <a title="Documentation">📖</a>
        <a title="Ideas">🤔</a>
        <a title="Maintenance">🚧</a>
        <a title="Infrastructure">🏗️</a>
      </td>
    </tr>
  </tbody>
</table>
<!-- ALL-CONTRIBUTORS-LIST:END -->

> Want your avatar here? Comment on any issue:
> `@all-contributors please add @YOUR_USERNAME for code`

---

## Install Goal

```bash
zap install toolchain
zap new project hello-zap
cd hello-zap
zap run
```

Zap's production toolchain will be distributed as a native `zap` binary, similar to Go's `go` command.

### Current Prototype

This repository still contains an early TypeScript prototype while the native compiler is being designed. That prototype is temporary research, not the final Zap runtime model.

```bash
git clone https://github.com/YOUR_USERNAME/zaplang
cd zaplang
npm install
npm run build
```

---

## Run Your First Program

Create `hello.zp`:
```
let name = "World"
print("Hello, " + name + "!")
```

```bash
zap run hello.zp
```

---

## Language Guide

### Variables
```
let name = "Murph"
let age  = 25
let done = true
```

### Functions
```
fn greet(name) {
  return "Hello, " + name + "!"
}

print(greet("World"))
```

### If / Else
```
if age >= 18 {
  print("Adult")
} else {
  print("Minor")
}
```

### Loop
```
loop i from 0 to 10 {
  print(i)
}
```

### Arrays
```
let fruits = ["apple", "banana", "mango"]
print(fruits[0])
```

### Objects
```
let user = { name: "Murph", age: 25 }
print(user.name)
```

### Built-in Functions

| Function       | What it does             |
|----------------|--------------------------|
| `print(x)`     | Print to console         |
| `len(x)`       | Length of string/array   |
| `toNumber(x)`  | Convert to number        |
| `toString(x)`  | Convert to string        |
| `json(x)`      | Convert to JSON string   |
| `parse(x)`     | Parse JSON string        |
| `type(x)`      | Get type of value        |

---

## Web Server (Full-Stack)

```
server on 3000 {
  get "/" -> fn(req) {
    return "<h1>Hello from Zap!</h1>"
  }

  get "/api/status" -> fn(req) {
    return { status: "ok", version: "1.0" }
  }

  post "/api/echo" -> fn(req) {
    return { received: req.body }
  }
}
```

```bash
zap run server.zp
# Server running on http://localhost:3000
```

---

## CLI Commands

```bash
zap run   <file.zp>    # Compile and run a Zap file
zap build <file.zp>    # Compile to a native binary
zap test               # Run package tests
zap fmt                # Format Zap source
zap install            # Install package dependencies
zap help               # Show help
```

---

## How It Works

Long-term native architecture:

```
your_file.zp
    ↓  Lexer    (text → tokens)
    ↓  Parser   (tokens → AST)
    ↓  Semantic Analyzer (AST → typed AST)
    ↓  Zap IR
    ↓  Optimizer
    ↓  Native Code Generator
    ↓  Zap Linker
    ↓  Native Binary
```

The current TypeScript implementation is an early research prototype only. The production direction is a Go-style self-contained Zap compiler and runtime.

---

## Contributing

This is an open-source project. PRs are welcome!

1. Fork the repo
2. Create your feature branch: `git checkout -b my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push: `git push origin my-feature`
5. Open a Pull Request

---

## License

MIT — Free to use, modify, and distribute.
