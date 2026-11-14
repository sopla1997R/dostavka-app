// Cuts dish photos out of a cafe's menu-page photos and saves them as clients/<slug>/img/<productId>.jpg.
// Usage: node tools/crop-from-menu.js <slug> <menu.js> <pagesDir>
//   menu.js exports { <slug>: [{ name, crop: [page, x0, y0, x1, y1] }, ...] }; pages are <pagesDir>/NN.jpg
// Run after make-client (it clears img/), before stock-photos (which then fills only the dishes still without a photo).
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const [slug, menuFile, pagesDir] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(path.join(root, "clients", slug + ".json"), "utf8"));
const items = require(path.resolve(menuFile))[slug];
const norm = s => String(s).toLowerCase().replace(/ё/g, "е").replace(/[«»"]/g, "").replace(/\s+/g, " ").trim();
const rows = [], missing = [];
for (const p of cfg.products) {
  const it = items.find(i => norm(i.name) === norm(p.name));
  if (!it) { missing.push(p.name); continue; }
  if (!it.crop) continue;
  const [pg, x0, y0, x1, y1] = it.crop;
  rows.push([p.id, String(pg).padStart(2, "0"), x0, y0, x1 - x0, y1 - y0].join(","));
}
const csv = path.join(root, "out", "crops-" + slug + ".csv");
fs.mkdirSync(path.dirname(csv), { recursive: true });
fs.writeFileSync(csv, rows.join("\n"));
const dir = path.join(root, "clients", slug, "img");
fs.mkdirSync(dir, { recursive: true });
if (rows.length) execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "crop-menu.ps1"), path.resolve(pagesDir), csv, dir], { stdio: "inherit" });
// the dishes now show the cafe's own photos
const f = path.join(root, "clients", slug + ".json");
const c = JSON.parse(fs.readFileSync(f, "utf8"));
if (c.pitch && rows.length) c.pitch.lead = c.pitch.lead.replace("ваши блюда и цены.", "ваши блюда, цены и фото.");
fs.writeFileSync(f, JSON.stringify(c, null, 1));
console.log(`${slug}: ${rows.length} photos cut from the menu${missing.length ? "; no menu match: " + missing.join(", ") : ""}`);
