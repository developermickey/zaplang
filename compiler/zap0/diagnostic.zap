package compiler.zap0

enum Severity {
  Error
  Warning
  Note
}

struct Diagnostic {
  severity: Severity
  message: String
  span: SourceSpan
}

struct Diagnostics {
  items: List<Diagnostic>
}

fn diagnostics() -> Diagnostics {
  return Diagnostics {
    items: List<Diagnostic>()
  }
}

fn error(message: String, span: SourceSpan) -> Diagnostic {
  return Diagnostic {
    severity: Severity.Error,
    message: message,
    span: span
  }
}

