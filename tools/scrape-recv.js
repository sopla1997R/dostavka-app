// Local helper for collecting a shop's menu from its own site in the browser.
// The browser tab opens http://127.0.0.1:4175/s/<slug>#<json> and this page saves the JSON to leads/scraped/<slug>.json.
// Usage: node tools/scrape-recv.js   (stops by itself after 3 hours)
const http = require("http"), fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "leads", "scraped");
fs.mkdirSync(dir, { recursive: true });
const page = `<!doctype html><meta charset="utf-8"><title>save</title><body>saving…<script>
fetch(location.pathname,{method:'POST',body:decodeURIComponent(location.hash.slice(1))}).then(r=>r.text()).then(t=>{document.body.textContent=t;document.title=t;history.replaceState(null,'',location.pathname)});
</script>`;
http.createServer((req, res) => {
  if (req.url.startsWith("/x.js")) {   // the extractor, loadable from any site's page
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Private-Network": "true", "Cache-Control": "no-store" });
    return res.end(fs.readFileSync(path.join(__dirname, "scrape-extract.js")));
  }
  if (req.url.startsWith("/go?")) {     // carries the extractor to the shop's site in window.name: then run (0,eval)(window.name) there
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><meta charset="utf-8"><script>fetch('/x.js').then(r=>r.text()).then(t=>{window.name=t;location.href=new URLSearchParams(location.search).get('u')})</script>`);
  }
  const m = req.url.match(/^\/s\/([a-z0-9-]+)$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (req.method === "GET") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end(page); }
  const chunks = []; let size = 0;
  req.on("data", c => { size += c.length; if (size > 5e6) req.destroy(); else chunks.push(c); });
  req.on("end", () => {
    let msg;
    try { const body = Buffer.concat(chunks).toString("utf8"); const j = JSON.parse(body); fs.writeFileSync(path.join(dir, m[1] + ".json"), JSON.stringify(j, null, 1)); msg = `saved ${m[1]}: ${(j.items || []).length} items`; }
    catch (e) { msg = "error " + e.message; }
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }); res.end(msg); console.log(msg);
  });
}).listen(4175, "127.0.0.1", () => console.log("listening 4175"));
setTimeout(() => process.exit(0), 3 * 60 * 60 * 1000);
