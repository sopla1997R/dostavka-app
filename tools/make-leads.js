// Turns the raw list of firms (leads/raw.json: { firmId: {city, name, phones, ...} }) into leads/shops.json:
// drops big chains and duplicates of the same company, gives every shop a URL slug.
// Usage: node tools/make-leads.js
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const raw = JSON.parse(fs.readFileSync(path.join(root, "leads", "raw.json"), "utf8"));

const MAX_BRANCHES = 6;                       // more than that is a chain with its own app
const CHAINS = /додо|папа джонс|ёбидоёби|якитория|il патио|гудман|суши make|суши восток|sushi days|вкусно — и точка|kfc|бургер кинг|rostic/i;
const CITY = { lensk: "Ленск", novosibirsk: "Новосибирск" };
const TYPE_AT = /, (?=(служба|кафе|ресторан|пиццерия|бар|суши|студия|сеть|компания|гастробар|траттория|доставка|паназиат|стрит|кулинар|семейн|итальян|азиат|гриль|пивн|магазин|столовая|кейтеринг|ресто|быстрое|кондитер|пекарн|киоск|бары|кофе)[а-яё-]*)/i;
// "sayoris. ru" → "sayoris.ru"; link labels like "Перейти в Telegram-канал" and job-site links are not a site
const cleanSite = u => { const x = String(u || "").replace(/\s+/g, ""); return /^[\wа-яё-]+(\.[\wа-яё-]+)*\.[a-zа-яё]{2,}(\/|$)/i.test(x) && !/hh\.ru|t\.me|max\.ru/i.test(x) ? x : ""; };
// checked by hand: these already take orders on their own site, so our demo offers them nothing new
const HAS_ORDERING = new Set(["kosmo-roll", "picca-lvica-i-sushi-lvushi", "kartel-rolls", "pingvi-sushi", "prosushi", "napoli", "fila", "nicks-food", "bento-sushi", "kruti-katay"]);
const FIXED_SLUG = { "70000001095491348": "imbir" };  // demos that already exist keep their links

const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
const slugify = s => s.toLowerCase().replace(/[а-яё]/g, c => TR[c] ?? "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32).replace(/-+$/, "");

const seenOrg = new Set(), usedSlug = new Set(["imbir"]);
const shops = [];
const entries = Object.entries(raw).filter(([, f]) => !f.error && f.name);
// most reviewed branch of a company goes first, so it is the one we keep
entries.sort((a, b) => (b[1].reviews || 0) - (a[1].reviews || 0));

for (const [id, f] of entries) {
  // "Сыр, томат и аромат, пиццерия" → name before the first comma that is followed by a type word
  const cut = f.name.search(TYPE_AT);
  const name = cut < 0 ? f.name : f.name.slice(0, cut);
  const rest = cut < 0 ? [] : [f.name.slice(cut + 2)];
  const site = cleanSite(f.site[0]);
  if (f.city !== "lensk") {
    if ((f.branches || 1) > MAX_BRANCHES || CHAINS.test(name)) continue;
    if (!f.phones.length && !f.wa.length && !f.tg.length && !f.vk.length) continue;   // nowhere to write
  }
  const orgKey = f.org || id;
  if (seenOrg.has(orgKey)) continue;
  seenOrg.add(orgKey);

  let slug = FIXED_SLUG[id] || slugify(name) || "shop-" + id.slice(-6);
  if (!FIXED_SLUG[id]) { const base = slug; let n = 2; while (usedSlug.has(slug)) slug = base + "-" + n++; }
  usedSlug.add(slug);

  const type = rest.join(", ") || (f.rubrics || [])[0] || "";
  // A: a delivery service or a small pizza/sushi/shawarma place; B: restaurants and bars, where delivery is a side business
  const hasOrdering = HAS_ORDERING.has(slug);
  const priority = hasOrdering ? "C" : f.city === "lensk" || /достав|суши|ролл|пицц|шаурм|пирог|быстр|стрит/i.test(type + " " + name) ? "A" : "B";
  shops.push({
    id, slug, city: CITY[f.city] || f.city, name, type: type ? type[0].toUpperCase() + type.slice(1) : "",
    rating: f.rating ?? "", reviews: f.reviews ?? "", branches: f.branches || 1,
    phones: f.phones, wa: f.wa[0] || "", tg: f.tg[0] || "", vk: f.vk[0] || "", site, email: f.email[0] || "",
    addr: [f.addr, f.note].filter(Boolean).join(", "), hours: f.hours,
    note: hasOrdering ? "уже есть свой онлайн-заказ на сайте" : [site ? "" : "нет сайта", f.goods ? "меню есть в 2ГИС" : ""].filter(Boolean).join("; "),
    gis: `https://2gis.ru/${f.city}/firm/${id}`, priority
  });
}

// Lensk first, then priority A before B, bigger first
shops.sort((a, b) => (a.city === "Ленск" ? 0 : 1) - (b.city === "Ленск" ? 0 : 1) || a.priority.localeCompare(b.priority) || (b.reviews || 0) - (a.reviews || 0));
fs.writeFileSync(path.join(root, "leads", "shops.json"), JSON.stringify(shops, null, 1));
const by = c => shops.filter(s => s.city === c).length;
console.log(`shops: ${shops.length} (Ленск ${by("Ленск")}, Новосибирск ${by("Новосибирск")}) from ${Object.keys(raw).length} firms · no site: ${shops.filter(s => !s.site).length} · A: ${shops.filter(s => s.priority === "A").length}, B: ${shops.filter(s => s.priority === "B").length}`);
