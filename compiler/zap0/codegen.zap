package compiler.zap0

struct ObjectFile {
  target: String
  bytes: Bytes
}

fn codegen(program: CheckedProgram, target: String) -> Result<ObjectFile, Diagnostics> {
  // v0 target: emit one native object file from checked Zap IR.
  // The first implementation should support fn main, integer arithmetic,
  // function calls, string literals, and runtime print.
  return ok(ObjectFile {
    target: target,
    bytes: Bytes()
  })
}

fn link(object: ObjectFile, outputPath: String) -> Result<Void, Diagnostics> {
  // v0 linker will write a native executable for the selected target.
  return ok()
}

