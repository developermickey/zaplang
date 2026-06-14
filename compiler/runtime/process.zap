package runtime

fn exit(code: Int) -> Never {
  // Native runtime contract:
  // terminate current process with the provided status code.
}

fn args() -> List<String> {
  // Native runtime contract:
  // return argv as Zap strings.
  return List<String>()
}

