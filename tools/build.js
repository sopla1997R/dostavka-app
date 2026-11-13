// Builds a client's app: takes the template (app/index.html) and swaps in the client's config.
// Usage: node tools/build.js imbir
//   reads  clients/imbir.json and photos from clients/imbir/img/web/<productId>.(jpg|webp|avif|png)
//   writes out/imbir/   — page for a Claude artifact (index.html + img/, files.json for the publish)
//          docs/imbir/  — installable app for GitHub Pages (+ manifest, service worker, icons)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const name = process.argv[2];
if (!name) { console.error("Usage: node tools/build.js <client>"); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(root, "clients", name + ".json"), "utf8"));
const template = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");

// Link photos: every product without "img" gets clients/<name>/img/web/<id>.* if it exists.
const photoDir = path.join(root, "clients", name, "img", "web");
const photos = fs.existsSync(photoDir) ? fs.readdirSync(photoDir) : [];
const byId = Object.fromEntries(photos.map(f => [path.parse(f).name, f]));
let linked = 0;
for (const p of cfg.products) if (!p.img && byId[p.id]) { p.img = "img/" + byId[p.id]; linked++; }
const used = [...new Set([...cfg.products.map(p => p.img), ...(cfg.banners || []).map(x => x.img), ...(cfg.stories || []).map(x => x.img)].filter(x => typeof x === "string" && x.startsWith("img/")))];

function page(c) {
  const open = '<script id="app-config" type="application/json">';
  const a = template.indexOf(open), b = template.indexOf("</script>", a);
  if (a < 0 || b < 0) throw new Error("config block not found in template");
  const json = JSON.stringify(c, null, 2).replace(/<\//g, "<\\/");
  let html = template.slice(0, a + open.length) + "\n" + json + "\n" + template.slice(b);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${c.brand.name}</title>`);
  if (c.theme && c.theme.bg) html = html.replace(/<meta name="theme-color" content="[^"]*">/, `<meta name="theme-color" content="${c.theme.bg}">`);
  return html;
}
function copyPhotos(dir) {
  fs.mkdirSync(path.join(dir, "img"), { recursive: true });
  for (const f of used) fs.copyFileSync(path.join(photoDir, path.basename(f)), path.join(dir, f));
}

// 1) Claude artifact: the host adds its own <head>; no install support there.
const outDir = path.join(root, "out", name);
copyPhotos(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), page({ ...cfg, pwa: false }));
fs.writeFileSync(path.join(outDir, "files.json"), JSON.stringify(Object.fromEntries(used.map(f => [f, f])), null, 1));

// 2) GitHub Pages: standalone page that can be installed to the home screen.
const pagesDir = path.join(root, "docs", name);
copyPhotos(pagesDir);
const t = cfg.theme || {};
const appName = cfg.brand.name, shortName = cfg.brand.shortName || cfg.brand.name;
const head = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  `<meta name="theme-color" content="${t.bg || "#F4F3F1"}">`,
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="icon" type="image/png" href="icons/icon-192.png">',
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  `<meta name="apple-mobile-web-app-title" content="${shortName}">`,
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<style>:root{padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
].join("\n");
fs.writeFileSync(path.join(pagesDir, "index.html"),
  `<!doctype html>\n<html lang="ru">\n<head>\n${head}\n</head>\n<body>\n${page({ ...cfg, pwa: true })}\n</body>\n</html>\n`);

fs.writeFileSync(path.join(pagesDir, "manifest.webmanifest"), JSON.stringify({
  name: appName, short_name: shortName, lang: "ru",
  description: cfg.brand.tagline || "",
  start_url: "./", scope: "./", display: "standalone", orientation: "portrait",
  background_color: t.bg || "#F4F3F1", theme_color: t.bg || "#F4F3F1",
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
}, null, 2));

// Service worker: page from network first (so menu updates show up), photos and icons from cache.
const version = name + "-" + Date.now().toString(36);
fs.writeFileSync(path.join(pagesDir, "sw.js"), `const V = ${JSON.stringify(version)};
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(V).then(c => c.addAll(["./", "manifest.webmanifest", "icons/icon-192.png"]))); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(V).then(x => x.put("./", c)); return r; }).catch(() => caches.match("./")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); } return r; })));
});
`);

// Icons: letter on the brand's dark ink (Windows only; skipped elsewhere if they already exist).
const iconsDir = path.join(pagesDir, "icons");
const letter = cfg.brand.monogram || cfg.brand.name[0];
try {
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "make-icons.ps1"),
    "-Letter", letter, "-Bg", t.ink || "#141414", "-Fg", t.bg || "#F5F4F2", "-Out", iconsDir], { stdio: "pipe" });
} catch (e) {
  if (!fs.existsSync(path.join(iconsDir, "icon-192.png"))) throw new Error("icons were not generated: " + e.message);
}

console.log(`built ${name} · ${cfg.products.length} products · ${linked} photos linked · out/${name} + docs/${name}`);
