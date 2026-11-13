// Makes a demo config from a menu collected on the shop's own site.
// Usage: node tools/make-client.js <slug> [--no-photos]
//   reads  leads/scraped/<slug>.json (menu) and leads/shops.json (name, contacts, hours)
//   writes clients/<slug>.json and downloads photos to clients/<slug>/img/<productId>.<ext>
// Then: powershell -File tools/shrink.ps1 clients/<slug>/img  and  node tools/build.js <slug>
// Delivery terms, bonuses and the APP10 promo code are our placeholders: the shop's real terms go in after they answer.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const slug = process.argv[2];
if (!slug) { console.error("Usage: node tools/make-client.js <slug>"); process.exit(1); }
const shop = JSON.parse(fs.readFileSync(path.join(root, "leads", "shops.json"), "utf8")).find(s => s.slug === slug);
if (!shop) throw new Error("no such shop in leads/shops.json: " + slug);
const scraped = JSON.parse(fs.readFileSync(path.join(root, "leads", "scraped", slug + ".json"), "utf8"));

const MAX_CATS = 8, MAX_PER_CAT = 8;
const SKIP_CAT = /акци|сертификат|палочк|для тебя|все для суши|всё для суши|заморозк|рекомендуем.+|новинки дня/i;
const EXTRA_CAT = /добавк|дополнит|соус|приправ|напитк|морс/i;      // small "add to order" categories go last
const ACCENTS = ["#D9467A", "#E0522D", "#2F7D5B", "#3D63C9", "#B8862B", "#8A4FC7", "#C7453B", "#1F8A8A"];
const PASTEL = ["#F1E9E2", "#EAEDE4", "#F2E6EA", "#E6ECF2", "#F2EEDD"];

const tidy = s => String(s || "").replace(/\s+/g, " ").replace(/^["«]|["»]$/g, "").trim();
// "ФО БО" → "Фо бо": names typed in caps are shown in normal case
const sentence = s => { s = tidy(s); const letters = s.replace(/[^А-ЯЁA-Zа-яёa-z]/g, ""); return letters.length >= 3 && s === s.toUpperCase() ? s[0] + s.slice(1).toLowerCase() : s; };
// "Рис и лапша по-вьетнамски" → "Рис и лапша": whole words up to 22 letters, never ending on "и", "с", "по"…
const shortCat = s => { if (s.length <= 22) return s; const out = []; for (const w of s.split(" ")) { if ((out.join(" ") + " " + w).trim().length > 22) break; out.push(w); } while (out.length > 1 && /^(и|с|со|по|в|на|из|для|&|-)$/i.test(out[out.length - 1])) out.pop(); return out.join(" ") || s.slice(0, 22); };
const catName = s => { s = sentence(s).replace(/\s*\(.*?\)\s*/g, " ").replace(/[^\wа-яё\s&-]/gi, "").trim(); return s ? s[0].toUpperCase() + s.slice(1) : "Меню"; };

// ── menu: group by category, drop junk, cap the size ──
// menus from 2GIS usually have no dish photos: the app then shows them as a list, so a category can hold more
const NO_PHOTOS = !!scraped.noPhotos, PER_CAT = NO_PHOTOS ? 20 : MAX_PER_CAT;
const HERO = (scraped.photos || []).length ? "img/hero1.jpg" : "";
const groups = new Map(), seenDish = new Set();
// "Популярное" goes last, so its dishes stay in their real sections
const ordered = scraped.items.slice().sort((x, y) => /популяр|хит|рекоменд/i.test(x.cat || "") - /популяр|хит|рекоменд/i.test(y.cat || ""));
for (const it of ordered) {
  const name = sentence(it.name);
  if (!name || /^[\d\s.,]+$/.test(name) || name.length < 3 || (!it.img && !scraped.noPhotos) || !it.price) continue;
  if (SKIP_CAT.test(it.cat || "")) continue;
  const cat = catName(it.cat);
  if (name.toLowerCase() === cat.toLowerCase()) continue;
  const key = name.toLowerCase() + "|" + it.price;
  if (seenDish.has(key)) continue;   // "Популярное" repeats dishes from other sections
  seenDish.add(key);
  if (!groups.has(cat)) groups.set(cat, []);
  groups.get(cat).push({ ...it, name });
}
let cats = [...groups.entries()].filter(([, items]) => items.length >= 2);
if (!cats.length) cats = [...groups.entries()];
cats.sort((a, b) => EXTRA_CAT.test(a[0]) - EXTRA_CAT.test(b[0]));
cats = cats.slice(0, MAX_CATS);

const categories = [], products = [], photos = [];
cats.forEach(([cat, items], ci) => {
  const id = "c" + (ci + 1);
  categories.push({ id, name: shortCat(cat) });
  items.slice(0, EXTRA_CAT.test(cat) ? 6 : PER_CAT).forEach((it, i) => {
    const pid = id + "p" + (i + 1);
    let desc = tidy(it.desc).replace(/^(состав|вес)\s*:\s*/i, "");
    if (desc.length > 220) desc = desc.slice(0, 217).replace(/[\s,;]+\S*$/, "") + "…";
    products.push({ id: pid, cat: id, name: it.name.slice(0, 60), desc, tags: i === 0 && ci < 3 && !EXTRA_CAT.test(cat) ? ["хит"] : [], price: it.price, weight: tidy(it.weight).replace(/(\d)\s*гр?\.?$/i, "$1 г") });
    if (it.img) photos.push([pid, it.img]);
  });
});
if (products.length < 6) throw new Error(`too few products for ${slug}: ${products.length}`);

// ── everything around the menu ──
const main = categories.filter(c => !EXTRA_CAT.test(c.name));
const first = id => products.find(p => p.cat === id);
const hours = /(\d{1,2}:\d{2}).(\d{1,2}:\d{2})/.exec(shop.hours || "") || [0, "10:00", "23:00"];
const [open, close] = shop.hours === "24/7" ? ["00:00", "23:59"] : [hours[1], hours[2]];
const fmtPhone = p => { const d = String(p || "").replace(/\D/g, ""); return d.length === 11 ? `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}` : (p || ""); };
const phone = fmtPhone(shop.phones[0] || shop.wa);
const hash = [...slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const addr = shop.addr.split(", ").slice(0, 2).join(", ");
const hit = first(main[0].id), second = first((main[1] || main[0]).id);
const extras = products.filter(p => EXTRA_CAT.test(categories.find(c => c.id === p.cat).name));
const upsell = (extras.length ? extras : [...products].sort((a, b) => a.price - b.price)).slice(0, 6).map(p => p.id);
const quote = shop.name.includes("«") ? shop.name : `«${shop.name}»`;

const cfg = {
  brand: { id: slug, name: shop.name, monogram: (shop.name.match(/[A-Za-zА-Яа-яЁё0-9]/) || ["•"])[0].toUpperCase(), tagline: main.slice(0, 3).map(c => c.name).join(", "), city: shop.city, searchHint: main.slice(0, 2).map(c => c.name.toLowerCase()).join(", ") + "…" },
  theme: { bg: "#F5F4F2", surface: "#FFFFFF", ink: "#141414", muted: "#8B8884", line: "#EAE8E4", primary: "#141414", onPrimary: "#FFFFFF", accent: ACCENTS[hash % ACCENTS.length], stage: "#EAE8E5" },
  fonts: { body: "Onest:wght@400;500;600;700" },
  pitch: {
    enabled: true, eyebrow: `Демо для ${quote}`, title: `${quote} в телефоне каждого клиента`,
    lead: (NO_PHOTOS ? "Мы перенесли ваше меню в приложение: ваши блюда и цены." : "Мы перенесли ваше меню в приложение: ваши блюда, цены и фото.") + " Клиент заказывает за минуту, без звонка и без комиссии агрегаторов.",
    points: ["Заказы сразу приходят вам в Telegram или WhatsApp", "Иконка на телефоне клиента: заказывают у вас, а не в агрегаторе", "Бонусы и промокоды возвращают клиентов за повторными заказами", "Меню, цены и акции меняются за пару минут", "Ставится на телефон без App Store"],
    try: "Попробуйте сами: соберите корзину и оформите заказ", contactLabel: "Хотите такое же?", contact: "Telegram @samir_gafaroff"
  },
  delivery: { minOrder: 800, freeFrom: 1500, price: 200, time: "45–70 мин", minutes: 60, pickupDiscount: 10, zones: [{ name: shop.city, time: "45–70 мин", price: "200 ₽, от 1 500 ₽ бесплатно" }] },
  contacts: { phone, address: addr, open, close, telegram: shop.tg ? "@" + shop.tg.replace(/^https?:\/\/t\.me\//, "").replace(/^\+/, "") : "" },
  banners: [
    { title: "Доставка бесплатно", text: "При заказе от 1 500 ₽", bg: PASTEL[hash % 5], img: NO_PHOTOS ? HERO : hit.id, action: { type: "cat", id: main[0].id } },
    { title: second.name.slice(0, 28), text: `Попробуйте: ${rubles(second.price)}`, bg: PASTEL[(hash + 1) % 5], img: NO_PHOTOS ? HERO : second.id, action: { type: "product", id: second.id } },
    { title: "−10% на первый заказ", text: "По промокоду APP10 в приложении", bg: PASTEL[(hash + 2) % 5], img: NO_PHOTOS ? HERO : (first((main[2] || main[0]).id) || hit).id, action: { type: "promo", code: "APP10" } }
  ],
  stories: NO_PHOTOS ? [] : main.slice(0, 5).map(c => { const p = first(c.id); const n = products.filter(x => x.cat === c.id).length; return { title: c.name.split(" ")[0], img: p.id, text: `${c.name}: ${n} ${n === 1 ? "позиция" : n < 5 ? "позиции" : "позиций"} в меню, от ${rubles(Math.min(...products.filter(x => x.cat === c.id).map(x => x.price)))}.`, button: "Смотреть", action: { type: "cat", id: c.id } }; }),
  categories, products, extras: {}, upsell,
  promocodes: [{ code: "APP10", percent: 10, text: "−10% на первый заказ через приложение" }],
  bonus: { name: "Бонусы", welcome: 200, percent: 5, maxSpendPercent: 30, levels: [{ name: "Гость", from: 0, percent: 5 }, { name: "Свой", from: 15000, percent: 7 }, { name: "Друг", from: 40000, percent: 10 }] },
  assistant: {
    name: "Помощник", greeting: "Привет! Подскажу, что взять, сколько ехать и как оплатить.",
    quick: ["Что посоветуете?", "Сколько ехать?", "Как оплатить?", "До скольки работаете?"],
    faq: [
      { keys: ["посовет", "что взять", "рекоменд", "вкусн", "популяр", "хит"], a: "Вот что заказывают чаще всего:", products: "tag:хит" },
      { keys: ["доставк", "ехать", "сколько", "долго", "время", "курьер"], a: "Привозим за 45–70 минут. Доставка 200 ₽, а от 1 500 ₽ бесплатно." },
      { keys: ["самовывоз", "забрать", "адрес", "где вы", "находитесь"], a: `Забрать можно по адресу: ${addr}. На самовывоз скидка 10%.` },
      { keys: ["оплат", "карт", "налич", "сбп", "перевод"], a: "Можно оплатить картой курьеру, наличными или переводом по СБП." },
      { keys: ["работа", "часы", "открыт", "закрыт", "график", "до скольки"], a: shop.hours === "24/7" ? "Работаем круглосуточно." : `Работаем каждый день с ${open} до ${close}.` },
      { keys: ["бонус", "балл", "кешб", "кэшб"], a: "За первый заказ в приложении дарим 200 бонусов, потом возвращаем 5% с каждого заказа." },
      { keys: ["промо", "скидк", "акци"], a: "Промокод APP10 даёт −10% на первый заказ через приложение. Вводите в корзине." },
      { keys: ["аллерг", "состав", "калор"], a: "Состав есть в карточке блюда. Если есть аллергия, напишите в комментарии к заказу." },
      { keys: ["привет", "здравств", "добр"], a: "Здравствуйте! Чем помочь?" },
      { keys: ["спасибо", "благодар"], a: "Пожалуйста! Приятного аппетита." }
    ],
    fallback: `Пока не знаю ответа. Позвоните нам: ${phone}.`
  }
};
function rubles(n) { return Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ") + " ₽"; }

fs.writeFileSync(path.join(root, "clients", slug + ".json"), JSON.stringify(cfg, null, 1));
console.log(`${slug}: ${categories.length} categories, ${products.length} products`);
if (process.argv.includes("--no-photos")) return;

// ── photos: a smaller version where the site's CDN can make one ──
const smaller = u => {
  let m;
  if ((m = u.match(/^https:\/\/static\.tildacdn\.com\/([^/]+)\/(.+)$/))) return [`https://thb.tildacdn.com/${m[1]}/-/resize/640x/${m[2]}`, u];
  if (/_w\d+_(png|jpe?g)\.(avif|webp)$/.test(u)) return [u.replace(/_w\d+_(png|jpe?g)\.(avif|webp)$/, "_w600_$1.webp"), u];
  if (/\/thumbs\/\d+_/.test(u)) return [u.replace(/\/thumbs\/\d+_/, "/"), u];
  return [u];
};
const imgDir = path.join(root, "clients", slug, "img");
fs.rmSync(imgDir, { recursive: true, force: true });
fs.mkdirSync(imgDir, { recursive: true });
async function grab([id, url]) {
  for (const u of smaller(url)) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(120000) });
      const type = r.headers.get("content-type") || "";
      if (!r.ok || !type.startsWith("image/")) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 1500 || buf.length > 15e6) continue;
      const ext = type.includes("webp") ? "webp" : type.includes("avif") ? "avif" : type.includes("png") ? "png" : "jpg";
      fs.writeFileSync(path.join(imgDir, id + "." + ext), buf);
      return buf.length;
    } catch (e) {}
  }
  return 0;
}
(scraped.photos || []).slice(0, 3).forEach((u, i) => photos.push(["hero" + (i + 1), u]));
(async () => {
  let ok = 0, bytes = 0; const queue = photos.slice();
  await Promise.all(Array.from({ length: 5 }, async () => { while (queue.length) { const n = await grab(queue.shift()); if (n) { ok++; bytes += n; } } }));
  console.log(`${slug}: photos ${ok}/${photos.length}, ${Math.round(bytes / 1024)} KB`);
})();
