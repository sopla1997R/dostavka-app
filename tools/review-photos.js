// Local contact sheet to check stand-in photos by eye: out/review.html (open via tools/serve.js at /out/review.html)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const slugs = process.argv.slice(2);
let html = `<!doctype html><meta charset="utf-8"><style>body{font:12px system-ui;margin:8px}h2{margin:14px 0 6px}.g{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}.c img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#eee}.c b{display:block;line-height:1.2}.c span{color:#888}</style>`;
for (const s of slugs) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "clients", s + ".json"), "utf8"));
  const dir = path.join(root, "clients", s, "img");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  html += `<h2>${s}</h2><div class="g">` + cfg.products.map((p, i) => { const f = files.find(x => x.startsWith(p.id + ".")); return `<div class="c">${f ? `<img src="/clients/${s}/img/${f}">` : "<img>"}<b>${i + 1}. ${p.name}</b><span>${p.id}</span></div>`; }).join("") + "</div>";
}
fs.mkdirSync(path.join(root, "out"), { recursive: true });
fs.writeFileSync(path.join(root, "out", "review.html"), html);
console.log("out/review.html");
