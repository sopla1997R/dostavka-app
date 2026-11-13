// Local preview.
//   http://localhost:4173/          → template (app/index.html), wrapped like a Claude artifact
//   http://localhost:4173/imbir/    → client build for the artifact (rebuilt from clients/imbir.json on every load)
//   http://localhost:4173/docs/...  → the GitHub Pages folder as is (installable app, service worker)
const http = require("http"), fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".png": "image/png", ".svg": "image/svg+xml" };
const wrap = body => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const send = (res, code, type, body) => { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/") return send(res, 200, TYPES[".html"], wrap(fs.readFileSync(path.join(root, "app", "index.html"), "utf8")));

  if (/^\/(out\/review\.html|clients\/[a-z0-9-]+\/img\/[\w.-]+)$/.test(url)) {   // local photo review only
    const f = path.join(root, url);
    if (fs.existsSync(f)) return send(res, 200, TYPES[path.extname(f)] || "application/octet-stream", fs.readFileSync(f));
  }
  if (url.startsWith("/docs/")) {
    let f = path.normalize(path.join(root, url));
    if (!f.startsWith(path.join(root, "docs"))) return send(res, 403, "text/plain", "forbidden");
    if (url.endsWith("/")) {
      const name = url.split("/")[2];
      if (name && fs.existsSync(path.join(root, "clients", name + ".json"))) execFileSync(process.execPath, [path.join(__dirname, "build.js"), name]);
      f = path.join(f, "index.html");
    }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(res, 404, "text/plain", "not found");
    return send(res, 200, TYPES[path.extname(f)] || "application/octet-stream", fs.readFileSync(f));
  }

  const m = url.match(/^\/([a-z0-9-]+)\/(.*)$/);
  if (m && fs.existsSync(path.join(root, "clients", m[1] + ".json"))) {
    const [, name, rest] = m;
    if (rest === "" || rest === "index.html") {
      execFileSync(process.execPath, [path.join(__dirname, "build.js"), name]);
      return send(res, 200, TYPES[".html"], wrap(fs.readFileSync(path.join(root, "out", name, "index.html"), "utf8")));
    }
    const f = path.join(root, "out", name, rest);
    if (/^img\/[\w.-]+$/.test(rest) && fs.existsSync(f)) return send(res, 200, TYPES[path.extname(f)] || "application/octet-stream", fs.readFileSync(f));
  }
  if (/^\/[a-z0-9-]+$/.test(url)) { res.writeHead(302, { Location: url + "/" }); return res.end(); }
  send(res, 404, "text/plain", "not found");
}).listen(4173, () => console.log("http://localhost:4173"));
