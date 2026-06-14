package compiler.zap0

fn main() -> Int {
  const args = process.args()

  if args.len < 2 {
    print("usage: zap0 build <file.zap> -o <output>")
    return 1
  }

  const command = args[1]

  if command == "build" {
    return buildCommand(args)
  }

  print("unknown command: {command}")
  return 1
}

fn buildCommand(args: List<String>) -> Int {
  const inputPath = args[2]
  const outputPath = outputArg(args).unwrapOr("a.out")
  const source = fs.readText(inputPath).unwrap()

  const tokens = lex(inputPath, source).unwrap()
  const ast = parse(tokens).unwrap()
  const checked = typecheck(ast).unwrap()
  const object = codegen(checked, host.target()).unwrap()

  link(object, outputPath).unwrap()
  return 0
}

fn outputArg(args: List<String>) -> Option<String> {
  let index = 0

  while index < args.len {
    if args[index] == "-o" && index + 1 < args.len {
      return some(args[index + 1])
    }
    index = index + 1
  }

  return none
}

