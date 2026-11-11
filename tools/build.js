// Builds a client's app: takes the template (app/index.html) and swaps in the client's config.
// Usage: node tools/build.js imbir
//   reads  clients/imbir.json and photos from clients/imbir/img/web/<productId>.(jpg|webp|avif|png)
//   writes out/imbir/index.html and out/imbir/img/*  (publish index.html with img/* as files)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const name = process.argv[2];
if (!name) { console.error("Usage: node tools/build.js <client>"); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(root, "clients", name + ".json"), "utf8"));
const outDir = path.join(root, "out", name);
fs.mkdirSync(path.join(outDir, "img"), { recursive: true });

// Link photos: every product without "img" gets clients/<name>/img/web/<id>.* if it exists.
const photoDir = path.join(root, "clients", name, "img", "web");
const photos = fs.existsSync(photoDir) ? fs.readdirSync(photoDir) : [];
const byId = Object.fromEntries(photos.map(f => [path.parse(f).name, f]));
let linked = 0;
for (const p of cfg.products) {
  if (!p.img && byId[p.id]) { p.img = "img/" + byId[p.id]; linked++; }
}
const used = new Set(cfg.products.map(p => p.img).filter(x => x && x.startsWith("img/")));
for (const f of used) fs.copyFileSync(path.join(photoDir, path.basename(f)), path.join(outDir, f));

let html = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const open = '<script id="app-config" type="application/json">';
const a = html.indexOf(open), b = html.indexOf("</script>", a);
if (a < 0 || b < 0) throw new Error("config block not found in template");
const json = JSON.stringify(cfg, null, 2).replace(/<\//g, "<\\/");
html = html.slice(0, a + open.length) + "\n" + json + "\n" + html.slice(b);
html = html.replace(/<title>[^<]*<\/title>/, `<title>${cfg.brand.name}</title>`);
if (cfg.theme && cfg.theme.bg) html = html.replace(/<meta name="theme-color" content="[^"]*">/, `<meta name="theme-color" content="${cfg.theme.bg}">`);
fs.writeFileSync(path.join(outDir, "index.html"), html);

// Standalone copy for GitHub Pages: docs/<name>/index.html (+ img/)
const pagesDir = path.join(root, "docs", name);
fs.mkdirSync(path.join(pagesDir, "img"), { recursive: true });
for (const f of used) fs.copyFileSync(path.join(outDir, f), path.join(pagesDir, f));
fs.writeFileSync(path.join(pagesDir, "index.html"),
  `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
  `<style>:root{padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`);

// files map for the Artifact publish
const files = Object.fromEntries([...used].map(f => [f, path.relative(root, path.join(outDir, f)).replace(/\\/g, "/")]));
fs.writeFileSync(path.join(outDir, "files.json"), JSON.stringify(files, null, 1));
console.log(`built out/${name}/index.html · ${cfg.products.length} products · ${linked} photos linked`);
