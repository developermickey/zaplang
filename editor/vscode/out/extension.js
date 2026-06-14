"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    console.log("⚡ Zap Language extension activated");
    // ── Run File ─────────────────────────────────────────────────────
    const runFile = vscode.commands.registerCommand("zap.runFile", () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return showError("No active Zap file open");
        const filePath = editor.document.fileName;
        if (!filePath.endsWith(".zap") && !filePath.endsWith(".zp")) {
            return showError("This is not a Zap file (.zap / .zp)");
        }
        editor.document.save().then(() => {
            const terminal = getOrCreateTerminal();
            const zapPath = getZapPath();
            terminal.show();
            terminal.sendText(`${zapPath} run "${filePath}"`);
        });
    });
    // ── Build to JS ───────────────────────────────────────────────────
    const buildFile = vscode.commands.registerCommand("zap.buildFile", () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return showError("No active Zap file open");
        const filePath = editor.document.fileName;
        editor.document.save().then(() => {
            const terminal = getOrCreateTerminal();
            const zapPath = getZapPath();
            terminal.show();
            terminal.sendText(`${zapPath} build "${filePath}"`);
            vscode.window.showInformationMessage("⚡ Zap: Building to JavaScript...");
        });
    });
    // ── Build Native ──────────────────────────────────────────────────
    const buildNative = vscode.commands.registerCommand("zap.buildNative", () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return showError("No active Zap file open");
        const filePath = editor.document.fileName;
        const outName = filePath.replace(/\.(zap|zp)$/, "");
        editor.document.save().then(() => {
            const terminal = getOrCreateTerminal();
            const zapPath = getZapPath();
            terminal.show();
            terminal.sendText(`${zapPath} build "${filePath}" --native -o "${outName}"`);
            vscode.window.showInformationMessage("⚡ Zap: Compiling to native binary...");
        });
    });
    // ── Hover Provider ────────────────────────────────────────────────
    const hoverProvider = vscode.languages.registerHoverProvider({ language: "zap" }, {
        provideHover(document, position) {
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);
            const info = HOVER_DOCS[word];
            if (!info)
                return null;
            const md = new vscode.MarkdownString();
            md.appendCodeblock(info.signature, "zap");
            md.appendMarkdown(`\n\n${info.doc}`);
            if (info.example) {
                md.appendMarkdown("\n\n**Example:**");
                md.appendCodeblock(info.example, "zap");
            }
            return new vscode.Hover(md, range);
        }
    });
    // ── Completion Provider ───────────────────────────────────────────
    const completionProvider = vscode.languages.registerCompletionItemProvider({ language: "zap" }, {
        provideCompletionItems(document, position) {
            const items = [];
            // Keywords
            const keywords = ["let", "fn", "if", "else", "while", "loop", "from", "to", "step",
                "return", "break", "continue", "try", "catch", "finally", "import", "export", "server", "on",
                "get", "post", "put", "delete", "patch", "true", "false", "null"];
            for (const kw of keywords) {
                const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
                items.push(item);
            }
            // Builtins with details
            for (const [name, info] of Object.entries(HOVER_DOCS)) {
                const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
                item.detail = info.signature;
                item.documentation = new vscode.MarkdownString(info.doc);
                items.push(item);
            }
            return items;
        }
    }, "." // trigger on dot
    );
    // ── Status Bar ────────────────────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.command = "zap.runFile";
    statusBar.text = "$(play) Run Zap";
    statusBar.tooltip = "⚡ Run this Zap file";
    statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && (editor.document.fileName.endsWith(".zap") || editor.document.fileName.endsWith(".zp"))) {
            statusBar.show();
        }
        else {
            statusBar.hide();
        }
    });
    if (vscode.window.activeTextEditor) {
        const fn = vscode.window.activeTextEditor.document.fileName;
        if (fn.endsWith(".zap") || fn.endsWith(".zp"))
            statusBar.show();
    }
    context.subscriptions.push(runFile, buildFile, buildNative, hoverProvider, completionProvider, statusBar);
    vscode.window.showInformationMessage("⚡ Zap Language support loaded!");
}
function deactivate() { }
// ── Helpers ───────────────────────────────────────────────────────────
function showError(msg) {
    vscode.window.showErrorMessage(`⚡ Zap: ${msg}`);
}
function getZapPath() {
    return vscode.workspace.getConfiguration("zap").get("zapPath") ?? "zap";
}
let _terminal = null;
function getOrCreateTerminal() {
    if (_terminal && !_terminal.exitStatus)
        return _terminal;
    _terminal = vscode.window.createTerminal("⚡ Zap");
    return _terminal;
}
// ── Hover docs for built-in functions ────────────────────────────────
const HOVER_DOCS = {
    print: { signature: "print(value)", doc: "Print a value to the console", example: 'print("Hello, World!")' },
    len: { signature: "len(x)", doc: "Returns the length of a string or array", example: "len(\"hello\") // 5" },
    sqrt: { signature: "sqrt(n)", doc: "Square root of n", example: "sqrt(144) // 12" },
    abs: { signature: "abs(n)", doc: "Absolute value", example: "abs(-5) // 5" },
    floor: { signature: "floor(n)", doc: "Round down to nearest integer", example: "floor(3.9) // 3" },
    ceil: { signature: "ceil(n)", doc: "Round up to nearest integer", example: "ceil(3.1) // 4" },
    round: { signature: "round(n)", doc: "Round to nearest integer", example: "round(3.5) // 4" },
    pow: { signature: "pow(base, exp)", doc: "Raise base to the power of exp", example: "pow(2, 8) // 256" },
    min: { signature: "min(a, b)", doc: "Returns the smaller of two numbers", example: "min(3, 7) // 3" },
    max: { signature: "max(a, b)", doc: "Returns the larger of two numbers", example: "max(3, 7) // 7" },
    random: { signature: "random()", doc: "Returns a random float between 0 and 1" },
    randomInt: { signature: "randomInt(min, max)", doc: "Returns a random integer between min and max", example: "randomInt(1, 10)" },
    upper: { signature: "upper(str)", doc: "Convert string to uppercase", example: 'upper("hello") // "HELLO"' },
    lower: { signature: "lower(str)", doc: "Convert string to lowercase", example: 'lower("HELLO") // "hello"' },
    trim: { signature: "trim(str)", doc: "Remove whitespace from both ends", example: 'trim("  hi  ") // "hi"' },
    split: { signature: "split(str, sep)", doc: "Split string into array", example: 'split("a,b,c", ",") // ["a","b","c"]' },
    join: { signature: "join(arr, sep)", doc: "Join array into string", example: 'join(["a","b"], ",") // "a,b"' },
    replace: { signature: "replace(str, from, to)", doc: "Replace substring", example: 'replace("hello", "l", "r") // "herro"' },
    includes: { signature: "includes(arr, val)", doc: "Check if array/string contains value" },
    push: { signature: "push(arr, val)", doc: "Add value to end of array" },
    pop: { signature: "pop(arr)", doc: "Remove and return last element" },
    keys: { signature: "keys(obj)", doc: "Get object keys as array" },
    values: { signature: "values(obj)", doc: "Get object values as array" },
    map: { signature: "map(arr, fn)", doc: "Transform array elements", example: "map([1,2,3], fn(x) { return x * 2 })" },
    filter: { signature: "filter(arr, fn)", doc: "Filter array elements", example: "filter([1,2,3,4], fn(x) { return x > 2 })" },
    reduce: { signature: "reduce(arr, fn, init)", doc: "Reduce array to single value" },
    json: { signature: "json(value)", doc: "Convert value to JSON string" },
    parse: { signature: "parse(str)", doc: "Parse JSON string to value" },
    toNumber: { signature: "toNumber(x)", doc: "Convert to number" },
    toStr: { signature: "toStr(x)", doc: "Convert to string" },
    type: { signature: "type(x)", doc: "Returns the type of a value as string", example: 'type("hello") // "string"' },
    now: { signature: "now()", doc: "Returns current timestamp in milliseconds" },
    sleep: { signature: "sleep(ms)", doc: "Pause execution for ms milliseconds", example: "sleep(1000) // wait 1 second" },
    env: { signature: "env(key)", doc: "Read an environment variable", example: 'env("HOME")' },
    exit: { signature: "exit(code?)", doc: "Exit the program with optional exit code" },
};
//# sourceMappingURL=extension.js.map