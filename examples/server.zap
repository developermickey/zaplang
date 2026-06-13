// Full-Stack Web Server in Zap

let appName = "My Zap App"

fn welcome(name) {
  return "<h1>Welcome " + name + "!</h1>"
}

server on 3000 {
  get "/" -> fn(req) {
    return "<html><body><h1>⚡ Zap Server Running!</h1><p>Built with Zap Language.</p><a href='/hello'>Say Hello</a></body></html>"
  }

  get "/hello" -> fn(req) {
    let msg = welcome("Zapper")
    return "<html><body>" + msg + "<br><a href='/'>Back</a></body></html>"
  }

  get "/api/status" -> fn(req) {
    return { status: "ok", app: "Zap Server", version: "1.0" }
  }

  post "/api/echo" -> fn(req) {
    return { received: true, data: req.body }
  }
}
