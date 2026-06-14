# Zap Editor Support

This directory contains editor assets for Zap.

## Syntax Highlighting

- `syntaxes/zap.tmLanguage.json`: TextMate grammar for Zap code colors
- `language-configuration.json`: comments, brackets, pairs, and indentation
- `vscode-extension.package.json`: VS Code extension manifest template
- `zap-icon-theme.json`: file icons for `.zap` and `.zp`

## VS Code Extension Layout

To package this as an extension later, copy or keep this structure:

```text
editor/
  vscode-extension.package.json
  language-configuration.json
  zap-icon-theme.json
  syntaxes/
    zap.tmLanguage.json
```

Then rename `vscode-extension.package.json` to `package.json` inside the extension package.

