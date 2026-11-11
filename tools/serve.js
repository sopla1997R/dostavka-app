// Local preview, wrapped the same way the artifact host wraps a page.
//   http://localhost:4173/          → template (app/index.html)
//   http://localhost:4173/imbir/    → client build (rebuilt from clients/imbir.json on every page load)
const http = require("http"), fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const TYPES = { ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".png": "image/png" };
const wrap = body => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const m = url.match(/^\/([a-z0-9-]+)\/(.*)$/);
  if (url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(wrap(fs.readFileSync(path.join(root, "app", "index.html"), "utf8")));
  }
  if (m && fs.existsSync(path.join(root, "clients", m[1] + ".json"))) {
    const [, name, rest] = m;
    if (rest === "" || rest === "index.html") {
      execFileSync(process.execPath, [path.join(__dirname, "build.js"), name]);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(wrap(fs.readFileSync(path.join(root, "out", name, "index.html"), "utf8")));
    }
    const f = path.join(root, "out", name, rest);
    if (/^img\/[\w.-]+$/.test(rest) && fs.existsSync(f)) {
      res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
      return res.end(fs.readFileSync(f));
    }
  }
  if (m && !url.endsWith("/") && !m[2]) { res.writeHead(302, { Location: url + "/" }); return res.end(); }
  res.writeHead(404); res.end("not found");
}).listen(4173, () => console.log("http://localhost:4173"));
