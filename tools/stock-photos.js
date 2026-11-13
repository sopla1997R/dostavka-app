// Stand-in dish photos for demo menus that have none: free-licensed photos from Wikimedia Commons.
// Usage: node tools/stock-photos.js <slug> [<slug>...]   (run after make-client.js, which clears the photo folder)
//   saves clients/<slug>/img/<productId>.jpg + credits.json, then points banners and stories at dish photos.
// These are NOT the cafe's own photos: fine for a pitch demo, to be replaced with real ones for a client.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const cachePath = path.join(root, "leads", "stock-cache.json");
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};
const UA = { "User-Agent": "demo-menu-builder/1.0 (presentation demo; github.com/zakaz-app)" };

// \b does not work with Cyrillic letters in JS, so word edges are written as (^|[^а-яё]) … (?![а-яё])
const W = "(?![а-яё])", S = "(^|[^а-яё])";
const re = src => new RegExp(src.replace(/<\$/g, S).replace(/\$>/g, W));
// dish name (lower case) → search query; first match wins
const RULES = [
  ["фо\\s*бо$>", "pho bo"], ["фо\\s*га$>", "pho ga chicken"], ["фо\\s*хай\\s*[сш]ан", "seafood pho"],
  ["фо\\s*[сш]о[тд]\\s*ванг", "beef stew vietnamese"], ["том\\s*(x|х)а", "tom kha"], ["том\\s*ям", "tom yum soup"],
  ["ми\\s*каи", "vietnamese noodle soup"], ["пад\\s*тай", "pad thai"], ["ми\\s*сао|мьен\\s*сао|бун\\s*сао|жар\\S*\\s*лапш|<$боне$>", "fried noodles"],
  ["ком\\s*ранг|жар\\S*\\s*рис|рис с .*яйц", "fried rice"], ["ком\\s*га", "com ga chicken rice"], ["ком\\s*бо", "beef rice bowl"],
  ["ком\\s*нем", "spring rolls rice"], ["ком\\s*шыонг", "pork chop rice"], ["нем\\s*том|спринг", "fried spring rolls"],
  ["гой\\s*куон", "goi cuon"], ["чынг\\s*куон", "banh cuon"], ["<$н[эе]м$>", "cha gio spring rolls"],
  ["том\\s*(чьен|чиен)|темпур", "shrimp tempura"], ["том\\s*чаи", "fried shrimp"], ["бо\\s*сао", "stir fried beef"],
  ["(том|хай\\s*[сш]ан)\\s*сао", "stir fried shrimp"], ["мык\\s*чиен", "fried squid"], ["тхит\\s*ранг", "caramelized pork"],
  ["ребр", "pork ribs"], ["га\\s*ран|крыл", "chicken wings"], ["бомбочк|нагет|наггет", "chicken nuggets"], ["курочк", "roast chicken"],
  ["ном\\s*(га|том)|рембо|дядюшки|^салат$", "vietnamese salad"], ["комбо", "asian food platter"],
  ["бууз", "buuz"], ["цуйван", "tsuivan"], ["баншатай|банш", "bansh dumpling soup"], ["шулэн|бухлеор", "mongolian soup"],
  ["лагман", "lagman"], ["оливье", "olivier salad"], ["винегрет", "vinegret"], ["свекол", "beetroot salad"],
  ["морковь по", "korean carrot salad"], ["курица в слив", "chicken cream sauce"], ["гуляш", "goulash"], ["фрикадел", "meatballs"],
  ["свинина по тайски|солнечн", "stir fried pork"], ["витамин|летн|бузовар", "vegetable salad"],
  ["цезарь с кревет", "caesar salad shrimp"], ["цезарь", "caesar salad"], ["салат с ростбиф", "roast beef salad"], ["баклажан", "eggplant salad"],
  ["чиабатт|сэндвич", "ciabatta sandwich"], ["куриная грудка", "grilled chicken breast"], ["бифштекс", "steak fried egg"],
  ["креветки гриль", "grilled shrimp"], ["брискет", "beef brisket"], ["колбаск", "grilled sausages"], ["язык", "beef tongue dish"],
  ["люля", "lula kebab"], ["гречк", "buckwheat mushrooms"], ["трюфел", "truffle fries"], ["чиз фри", "cheese fries"], ["фри", "french fries"],
  ["дольк", "potato wedges"], ["батат", "baked sweet potato"], ["сырные палочки", "mozzarella sticks"], ["^ростбиф", "roast beef"],
  ["медовик", "medovik honey cake"], ["павлов", "pavlova dessert"], ["кофейное зерно", "chocolate mousse"],
  ["четыре сыра", "quattro formaggi pizza"], ["пепперони", "pepperoni pizza"], ["маргарит", "margherita pizza"], ["груш", "pear gorgonzola pizza"],
  ["мясное ассорти", "meat pizza"], ["с индейкой и гриб|с ветчиной и гриб", "mushroom pizza"], ["шампиньон", "baked mushrooms"],
  ["паста.*морепр", "seafood pasta"], ["суп с индейкой", "chicken noodle soup"], ["кесади", "quesadilla"], ["крем.?суп сыр", "cheese soup"],
  ["крем.?суп гриб", "mushroom soup"], ["феттуч", "fettuccine"], ["карбонар", "spaghetti carbonara"], ["щечк", "beef cheeks mashed potatoes"],
  ["запеч\\S* овощ", "roasted vegetables"], ["^рис$|рис с овощ", "steamed rice bowl"],
  ["фин", "vietnamese coffee phin"], ["капучино|кофе", "cappuccino"], ["бабл", "bubble tea"], ["смузи|манго", "mango smoothie"],
  ["маракуй|ананас|сок", "fruit juice glass"], ["коктейл", "fruit cocktail glass"], ["холодный чай", "iced tea"], ["чай монгол", "suutei tsai"],
  ["чай", "cup of tea"], ["морс", "mors drink"], ["компот", "kompot"]
].map(([r, q]) => [re(r), q]);
const BY_CAT = [[/суп/i, "soup bowl"], [/салат/i, "salad"], [/напит/i, "drink glass"], [/закуск/i, "appetizer"], [/десерт/i, "dessert"], [/пицц/i, "pizza"]];
const BURGER = [[/фирменн/, "bacon cheeseburger"], [/яйц/, "burger egg"], [/ягод|сырн/, "cheeseburger"], [/мексик/, "jalapeno burger"],
  [/рван/, "pulled beef burger"], [/кури/, "chicken burger"], [/вегет/, "veggie burger"], [/смэш/, "smash burger"], [/класс/, "hamburger"]];
const BAD = /menu|sign|logo|restaurant|interior|store|shop|market|people|woman|girl|boy|street|stall|vendor|kitchen|chef|recipe|map|building|label|package|packag|advert|poster|stamp|coin|painting|drawing|illustration|svg|diagram/i;

function queryFor(p, catName) {
  const n = p.name.toLowerCase();
  if (/бургер/i.test(catName)) { for (const [r, q] of BURGER) if (r.test(n)) return q; return "hamburger"; }
  for (const [r, q] of RULES) if (r.test(n)) return q;
  for (const [r, q] of BY_CAT) if (r.test(catName)) return q;
  return "food dish";
}

async function search(q) {
  if (cache[q] && cache[q].length) return cache[q];
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=40"
    + "&gsrsearch=" + encodeURIComponent(q + " filetype:bitmap") + "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=720";
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (r && r.ok) {
      const j = await r.json();
      const pages = Object.values((j.query || {}).pages || {}).sort((a, b) => a.index - b.index);
      const plain = v => String((v || {}).value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      cache[q] = pages.map(p => ({ p, i: (p.imageinfo || [])[0] || {} }))
        .filter(({ p, i }) => /jpe?g|png|webp/.test(i.mime || "") && i.width >= 600 && i.height >= 400 && i.width / i.height >= 0.9 && i.width / i.height <= 2.1 && !BAD.test(p.title))
        .map(({ p, i }) => { const m = i.extmetadata || {}; return { id: "c" + p.pageid, thumb: i.thumburl, url: i.url, title: p.title.replace(/^File:/, ""), creator: plain(m.Artist).slice(0, 80), license: plain(m.LicenseShortName), page: i.descriptionurl }; })
        .filter(c => /^(cc|public domain|pd)/i.test(c.license));          // only free licences
      fs.writeFileSync(cachePath, JSON.stringify(cache));
      await new Promise(r => setTimeout(r, 300));
      return cache[q];
    }
    await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
  }
  return [];
}

async function download(c) {
  for (const u of [c.thumb, c.url]) {
    try {
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) });
      const type = r.headers.get("content-type") || "";
      if (!r.ok || !/image\/(jpe?g|png|webp)/.test(type)) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 8000 && buf.length < 12e6) return { buf, ext: type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg" };
    } catch (e) {}
  }
  return null;
}

// --fix <file>: re-pick the photos listed in the file ({ slug: { productId: "better query" } }), never reusing a rejected one
const fixArg = process.argv.indexOf("--fix");
const FIX = fixArg > 0 ? JSON.parse(fs.readFileSync(process.argv[fixArg + 1], "utf8")) : null;
const rejectedPath = path.join(root, "leads", "stock-rejected.json");
const rejected = new Set(fs.existsSync(rejectedPath) ? JSON.parse(fs.readFileSync(rejectedPath, "utf8")) : []);

(async () => {
  const used = new Set(rejected);
  if (FIX) for (const slug of Object.keys(FIX)) {   // photos already in use elsewhere stay unique
    const cr = path.join(root, "clients", slug, "img", "credits.json");
    if (fs.existsSync(cr)) for (const c of Object.values(JSON.parse(fs.readFileSync(cr, "utf8")))) if (c.id) used.add(c.id);
  }
  for (const slug of FIX ? Object.keys(FIX) : process.argv.slice(2)) {
    const cfgPath = path.join(root, "clients", slug + ".json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    const dir = path.join(root, "clients", slug, "img");
    fs.mkdirSync(dir, { recursive: true });
    const credPath = path.join(dir, "credits.json");
    const credits = FIX && fs.existsSync(credPath) ? JSON.parse(fs.readFileSync(credPath, "utf8")) : {};
    let ok = 0;
    for (const p of cfg.products) {
      if (p.img) continue;
      if (FIX && !FIX[slug][p.id]) continue;
      if (FIX) {
        for (const f of fs.readdirSync(dir)) if (f.startsWith(p.id + ".")) fs.unlinkSync(path.join(dir, f));
        const old = credits[p.id]; if (old && old.id) { rejected.add(old.id); used.add(old.id); }
      }
      const cat = (cfg.categories.find(c => c.id === p.cat) || {}).name || "";
      const q = FIX ? FIX[slug][p.id] : queryFor(p, cat);
      let got = false;
      for (const c of await search(q)) {
        if (used.has(c.id)) continue;
        const d = await download(c);
        if (!d) continue;
        used.add(c.id);
        fs.writeFileSync(path.join(dir, p.id + "." + d.ext), d.buf);
        credits[p.id] = { id: c.id, dish: p.name, query: q, title: c.title, creator: c.creator, license: c.license, page: c.page };
        ok++; got = true; break;
      }
      if (!got) console.log(`  no photo: ${p.name} (${q})`);
    }
    fs.writeFileSync(credPath, JSON.stringify(credits, null, 1));
    fs.writeFileSync(rejectedPath, JSON.stringify([...rejected]));

    // with dish photos in place, banners and stories can show dishes instead of the one cafe photo
    const files = fs.readdirSync(dir);
    const has = id => files.some(f => f.startsWith(id + "."));
    const firstWithPhoto = catId => cfg.products.find(x => x.cat === catId && has(x.id));
    const main = cfg.categories.filter(c => !/напит|добавк|соус|гарнир/i.test(c.name));
    cfg.stories = main.slice(0, 5).map(c => ({ c, p: firstWithPhoto(c.id) })).filter(x => x.p).map(({ c, p }) => {
      const n = cfg.products.filter(x => x.cat === c.id).length;
      return { title: c.name.split(" ")[0], img: p.id, text: `${c.name}: ${n} ${n === 1 ? "позиция" : n < 5 ? "позиции" : "позиций"} в меню.`, button: "Смотреть", action: { type: "cat", id: c.id } };
    });
    cfg.banners.forEach((b, i) => { const p = firstWithPhoto((main[i] || main[0]).id); if (p && i > 0) b.img = p.id; });
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 1));
    console.log(`${slug}: ${ok}/${cfg.products.filter(p => !p.img).length} photos`);
  }
})();
