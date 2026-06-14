/**
 * Zap built-in test runner — `zap test`
 * Usage: test("name", fn() { ... })
 *        assert(condition)
 *        assertEq(a, b)
 *        assertThrows(fn)
 */
import * as fs from "fs"
import * as path from "path"
import * as vm from "vm"
import { lex } from "./lexer"
import { Parser } from "./parser"
import { transpile } from "./transpiler"

// ── ANSI colors ─────────────────────────────────────────────────────
const GREEN  = "\x1b[32m"
const RED    = "\x1b[31m"
const YELLOW = "\x1b[33m"
const GRAY   = "\x1b[90m"
const BOLD   = "\x1b[1m"
const RESET  = "\x1b[0m"
const DIM    = "\x1b[2m"

interface TestResult {
  name:     string
  passed:   boolean
  error?:   string
  duration: number
}

interface SuiteResult {
  file:    string
  results: TestResult[]
  duration: number
}

function zapToJS(source: string): string {
  return transpile(new Parser(lex(source)).parse())
}

/** Run all test() calls in a single .zap test file */
export function runTestFile(filePath: string): SuiteResult {
  const source = fs.readFileSync(filePath, "utf-8")
  const start = Date.now()
  const results: TestResult[] = []

  // vm context shared by all tests in this file
  const ctx: Record<string, unknown> = { console, process, setTimeout, clearTimeout }
  vm.createContext(ctx)

  // Inject test runtime into context
  vm.runInContext(`
    var __tests = [];
    var __current = null;
    var __failures = [];

    // Zap uses .len() — JS arrays only have .length, so we shim it
    if (!Array.prototype.len) {
      Object.defineProperty(Array.prototype, 'len', { value: function() { return this.length; }, configurable: true });
    }

    function test(name, fn) {
      __tests.push({ name, fn });
    }

    function assert(cond, msg) {
      if (!cond) {
        var err = msg || "Assertion failed: expected truthy value";
        throw new Error(err);
      }
    }

    function assertEq(a, b, msg) {
      var aStr = JSON.stringify(a);
      var bStr = JSON.stringify(b);
      if (aStr !== bStr) {
        throw new Error(msg || ("Expected " + aStr + " to equal " + bStr));
      }
    }

    function assertNotEq(a, b, msg) {
      var aStr = JSON.stringify(a);
      var bStr = JSON.stringify(b);
      if (aStr === bStr) {
        throw new Error(msg || ("Expected values to differ, both were " + aStr));
      }
    }

    function assertThrows(fn, msg) {
      var threw = false;
      try { fn(); } catch(e) { threw = true; }
      if (!threw) throw new Error(msg || "Expected function to throw but it did not");
    }

    function assertGt(a, b, msg) {
      if (!(a > b)) throw new Error(msg || (a + " is not greater than " + b));
    }

    function assertLt(a, b, msg) {
      if (!(a < b)) throw new Error(msg || (a + " is not less than " + b));
    }

    function assertIncludes(arr, val, msg) {
      if (!arr.includes(val)) throw new Error(msg || (JSON.stringify(val) + " not found in array"));
    }

    var print = function() {};  // silence print() in tests
    var len   = (x) => Array.isArray(x) ? x.length : String(x).length;
    var range = (a, b) => { var r=[]; for(var i=a;i<b;i++) r.push(i); return r; };
  `, ctx)

  // Transpile the test file and run it to register test() calls
  let js: string
  try {
    js = zapToJS(source)
    // Replace let/const with var for vm context
    js = js.replace(/\b(let|const)\b/g, "var")
    vm.runInContext(js, ctx, { timeout: 10000 })
  } catch (e: any) {
    results.push({
      name: "(file load)",
      passed: false,
      error: e.message,
      duration: 0,
    })
    return { file: filePath, results, duration: Date.now() - start }
  }

  // Execute each registered test
  const tests = (ctx as any).__tests as { name: string; fn: () => void }[]

  for (const t of tests) {
    const tStart = Date.now()
    try {
      t.fn()
      results.push({ name: t.name, passed: true, duration: Date.now() - tStart })
    } catch (e: any) {
      results.push({
        name: t.name,
        passed: false,
        error: e.message,
        duration: Date.now() - tStart,
      })
    }
  }

  return { file: filePath, results, duration: Date.now() - start }
}

/** Find all *.test.zp and *.test.zap files under a directory */
export function findTestFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...findTestFiles(full))
    } else if (entry.isFile() && /\.test\.(zap|zp)$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

/** Print results and return exit code */
export function runTests(targets: string[], flags: string[]): void {
  const watch  = flags.includes("--watch")
  const only   = flags.find(f => f.startsWith("--filter="))?.split("=")[1]

  let testFiles: string[] = []

  for (const t of targets) {
    if (!fs.existsSync(t)) {
      console.error(`${RED}[zap test]${RESET} Not found: ${t}`)
      process.exit(1)
    }
    const stat = fs.statSync(t)
    if (stat.isDirectory()) {
      testFiles.push(...findTestFiles(t))
    } else {
      testFiles.push(t)
    }
  }

  if (testFiles.length === 0) {
    console.log(`${YELLOW}[zap test]${RESET} No test files found (*.test.zp / *.test.zap)`)
    process.exit(0)
  }

  executeAll(testFiles, only)
}

function executeAll(testFiles: string[], filter?: string) {
  const suites: SuiteResult[] = []

  console.log(`\n${BOLD}⚡ Zap Test Runner${RESET}  ${DIM}${testFiles.length} file(s)${RESET}\n`)

  for (const file of testFiles) {
    const rel = path.relative(process.cwd(), file)
    const suite = runTestFile(file)
    suites.push(suite)

    const passed  = suite.results.filter(r => r.passed).length
    const failed  = suite.results.filter(r => !r.passed).length
    const total   = suite.results.length

    console.log(`${BOLD}${rel}${RESET}  ${DIM}(${suite.duration}ms)${RESET}`)

    for (const r of suite.results) {
      if (filter && !r.name.toLowerCase().includes(filter.toLowerCase())) continue
      const icon = r.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
      const dur  = `${DIM}${r.duration}ms${RESET}`
      console.log(`  ${icon} ${r.name}  ${dur}`)
      if (!r.passed && r.error) {
        console.log(`    ${RED}${r.error}${RESET}`)
      }
    }

    const statusLine = failed === 0
      ? `  ${GREEN}${passed} passed${RESET}`
      : `  ${RED}${failed} failed${RESET}  ${GREEN}${passed} passed${RESET}`
    console.log(`  ${statusLine}  ${DIM}${total} total${RESET}\n`)
  }

  // ── Summary ──────────────────────────────────────────────
  const totalPassed  = suites.flatMap(s => s.results).filter(r => r.passed).length
  const totalFailed  = suites.flatMap(s => s.results).filter(r => !r.passed).length
  const totalTests   = totalPassed + totalFailed
  const totalTime    = suites.reduce((s, x) => s + x.duration, 0)

  console.log("─".repeat(48))
  if (totalFailed === 0) {
    console.log(`${GREEN}${BOLD} PASS ${RESET}  ${totalPassed}/${totalTests} tests passed  ${DIM}${totalTime}ms${RESET}`)
  } else {
    console.log(`${RED}${BOLD} FAIL ${RESET}  ${totalFailed} failed, ${totalPassed} passed  ${DIM}${totalTime}ms${RESET}`)
  }
  console.log("")

  if (totalFailed > 0) process.exit(1)
}
