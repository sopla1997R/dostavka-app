// Turns data collected on 2GIS pages into our inputs:
//   leads/scraped/firms9.json  { slug: {id, name, phones, ...} }   → merged into leads/raw.json (then run make-leads.js)
//   leads/scraped/menus9.json  { slug: {cats:[{name,count,items}], photos:[url]} } → leads/scraped/<shopSlug>.json for make-client.js
// Usage: node tools/from-2gis.js <firms file> <menus file>
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const [firmsFile, menusFile] = process.argv.slice(2).map(f => path.join(root, "leads", "scraped", f));
const firms = JSON.parse(fs.readFileSync(firmsFile, "utf8"));
const menus = JSON.parse(fs.readFileSync(menusFile, "utf8"));

const rawPath = path.join(root, "leads", "raw.json");
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
for (const f of Object.values(firms)) if (f.id && !f.error) { const { id, menuCount, ...rest } = f; raw[id] = rest; }
fs.writeFileSync(rawPath, JSON.stringify(raw));

const out = {};
for (const [key, m] of Object.entries(menus)) {
  const f = firms[key]; if (!f) continue;
  let cats = (m.cats || []).filter(c => c.items.length);
  if (cats.length > 1) cats = cats.filter(c => !(c.name === "Меню" && !c.count));   // the paid "Меню — реклама" block repeats real dishes
  const items = cats.flatMap(c => c.items.map(i => ({ name: i.name, desc: i.desc || "", price: i.price, weight: "", img: i.img || "", cat: c.name })));
  out[f.id] = { site: "2gis", noPhotos: !items.some(i => i.img), photos: m.photos || [], items };
}
fs.writeFileSync(path.join(root, "leads", "scraped", "_by-firm-id.json"), JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([id, o]) => `${firms[Object.keys(firms).find(k => firms[k].id === id)].name}: ${o.items.length} items, ${o.photos.length} photos`).join("\n"));
