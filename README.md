# ⚡ Zap Language

> A simple, fast programming language for building full-stack web apps.
> Files use `.zap` or `.zp` extension.

Created by **Mukesh Pathak** — Founder, MurphTech Software Solutions

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

## Install

```bash
git clone https://github.com/YOUR_USERNAME/zaplang
cd zaplang
npm install
npm run build
npm link        # makes 'zap' command available globally
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
zap run   <file.zp>    # Run a Zap file
zap build <file.zp>    # Compile to JavaScript
zap help               # Show help
```

---

## How It Works

```
your_file.zp
    ↓  Lexer    (text → tokens)
    ↓  Parser   (tokens → AST)
    ↓  Transpiler (AST → JavaScript)
    ↓  Node.js  (runs the output)
```

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
