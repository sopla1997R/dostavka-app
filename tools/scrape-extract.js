// Runs inside a shop's own site (pasted into the browser). Finds menu cards by looking for a price next to a photo.
//   await __x.scroll()            – scroll the page so lazy photos load
//   __x.run({cat: "Пицца"})       – collect cards from this page (cat overrides the section heading), adds to the running total
//   __x.send("slug")              – hand everything collected on this site to tools/scrape-recv.js
window.__x = (() => {
  const priceRe = /(\d{1,3}(?:[\s ]\d{3})|\d{2,5})(?:[.,]\d{2})?\s*(?:₽|руб|р\.|р(?![а-яёa-z]))/i;
  const btnRe = /^(в корзину|заказать|выбрать|добавить|купить|хочу|подробнее|\+|-|−)$/i;
  const clean = s => (s || "").replace(/\s+/g, " ").trim();
  const own = e => clean([...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(" "));
  const abs = u => { try { return new URL(u, location.href).href; } catch (e) { return ""; } };

  function imgOf(card) {
    for (const im of card.querySelectorAll("img")) {
      const lazy = im.getAttribute("data-src") || im.getAttribute("data-original") || im.getAttribute("data-lazy-src") || im.getAttribute("data-lazy");
      const u = lazy || im.currentSrc || im.src || "";
      if (!u || /^data:/.test(u) || /\.svg(\?|$)/i.test(u)) continue;
      if (im.naturalWidth && im.naturalWidth < 80) continue;
      return abs(u);
    }
    for (const e of [card, ...card.querySelectorAll("*")]) {
      const o = e.getAttribute("data-original") || e.getAttribute("data-bg") || e.getAttribute("data-background");
      if (o && !/\.svg/i.test(o)) return abs(o);
      const m = getComputedStyle(e).backgroundImage.match(/url\(["']?(.+?)["']?\)/);
      if (m && !/\.svg|^data:/i.test(m[1])) return abs(m[1]);
    }
    return "";
  }

  // Tilda shops (a very common engine for small deliveries) mark products explicitly
  function tilda(opts) {
    const titleOf = rec => { const t = rec && rec.querySelector(".t-section__title, .t-title, [field='title'], [field='btitle']"); const s = t ? clean(t.innerText) : ""; return s.length > 1 && s.length < 40 ? s : ""; };
    const items = [];
    for (const p of document.querySelectorAll(".js-product")) {
      const name = clean((p.querySelector(".js-product-name, .js-store-prod-name") || {}).innerText);
      const pe = p.querySelector(".js-product-price, .js-store-prod-price-val");
      const price = +String((pe && (pe.getAttribute("data-product-price-def") || pe.innerText)) || "").replace(/[^\d.,]/g, "").replace(",", ".") || 0;
      if (!name || price < 20) continue;
      const im = p.querySelector(".js-product-img");
      let img = im ? (im.getAttribute("data-original") || im.getAttribute("src") || "") : "";
      if (!img) img = imgOf(p);
      const desc = clean((p.querySelector(".js-store-prod-descr, .t-store__card__descr, [field^='li_descr'], .t-descr") || {}).innerText).slice(0, 400);
      let cat = opts.cat || "";
      for (let rec = p.closest(".t-rec"), n = 0; !cat && rec && n < 4; rec = rec.previousElementSibling, n++) cat = titleOf(rec);
      const weight = (desc.match(/\d+[.,]?\d*\s*(?:гр?|кг|мл|л|шт|см)(?![а-яё])\.?/i) || [""])[0];
      items.push({ name, desc, price, weight, img: abs(img), cat });
    }
    return items;
  }

  function run(opts = {}) {
    const isLeafPrice = e => { const t = own(e); if (t.length >= 40) return false; if (priceRe.test(t)) return true;
      return /^\d[\d\s ]{1,6}$/.test(t) && e.parentElement && priceRe.test(clean(e.parentElement.innerText).slice(0, 60)) && clean(e.parentElement.innerText).length < 40; };
    const leaves = [...document.body.querySelectorAll("*")].filter(e => !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(e.tagName) && e.offsetParent !== null && isLeafPrice(e));
    const cards = new Map();
    for (const leaf of leaves) {
      let c = leaf, found = null;
      for (let i = 0; i < 9 && c.parentElement && c !== document.body; i++) {
        c = c.parentElement;
        const prices = leaves.filter(l => c.contains(l)).length;
        if (prices > 4) break;                       // climbed out of a single card
        if (imgOf(c)) { found = c; break; }
      }
      if (found && !cards.has(found)) cards.set(found, leaf);
    }
    const cardEls = [...cards.keys()];
    const heads = [...document.querySelectorAll("h1,h2,h3,[class*='category' i],[class*='section-title' i],[class*='t-title' i],[class*='t-section__title' i]")]
      .filter(h => h.offsetParent !== null && !cardEls.some(c => c.contains(h)) && clean(h.innerText).length > 1 && clean(h.innerText).length < 40);
    const pageH1 = clean((document.querySelector("h1") || {}).innerText || "");
    const items = document.querySelector(".js-product") ? tilda(opts) : [];
    for (const [card, leaf] of (items.length ? [] : cards)) {
      const price = +(own(leaf).match(priceRe) || [0, own(leaf)])[1].replace(/[\s ]/g, "");
      const lines = card.innerText.split("\n").map(clean).filter(Boolean);
      let name = "";
      for (const el of card.querySelectorAll("h1,h2,h3,h4,h5,h6,[class*='title' i],[class*='name' i],[class*='header' i],a,b,strong")) {
        const t = clean(el.innerText);
        if (t.length >= 2 && t.length <= 80 && !priceRe.test(t) && !btnRe.test(t) && !/^\d+$/.test(t)) { name = t; break; }
      }
      if (!name) name = lines.find(l => l.length >= 2 && l.length <= 80 && !priceRe.test(l) && !btnRe.test(l) && !/^[\d\s.,]+$/.test(l)) || "";
      if (!name || price < 20) continue;
      const rest = lines.filter(l => l !== name && !btnRe.test(l) && !(priceRe.test(l) && l.length < 25));
      const weight = (rest.join(" ").match(/\d+[.,]?\d*\s*(?:гр?|кг|мл|л|шт|см)(?![а-яё])\.?/i) || [""])[0];
      const desc = rest.filter(l => l.length >= 12 && l.length <= 400 && !l.includes(name)).sort((a, b) => b.length - a.length)[0] || "";
      let cat = opts.cat || "";
      if (!cat) { let best = null; for (const h of heads) if (h.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING) best = h; cat = best ? clean(best.innerText) : pageH1; }
      items.push({ name, desc, price, weight, img: imgOf(card), cat });
    }
    const all = JSON.parse(sessionStorage.getItem("__menu") || "[]");
    const seen = new Set(all.map(i => i.name + "|" + i.price));
    let added = 0;
    for (const it of items) if (!seen.has(it.name + "|" + it.price)) { seen.add(it.name + "|" + it.price); all.push(it); added++; }
    sessionStorage.setItem("__menu", JSON.stringify(all));
    const cats = {}; all.forEach(i => cats[i.cat] = (cats[i.cat] || 0) + 1);
    return { leaves: leaves.length, found: items.length, added, total: all.length, noImg: all.filter(i => !i.img).length, cats, sample: items.slice(0, 3) };
  }

  async function scroll() {
    const h = () => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    // plain timers: requestAnimationFrame never fires while the tab is in the background
    for (let y = 0, n = 0; y < h() && n < 30; y += Math.max(innerHeight * 0.9, h() / 30), n++) { scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); }
    scrollTo(0, 0);
    return h();
  }

  const links = re => [...new Set([...document.querySelectorAll("a[href]")].filter(a => re.test(a.href) || re.test(clean(a.innerText))).map(a => clean(a.innerText).slice(0, 30) + " → " + a.href))].slice(0, 40);
  const reset = () => sessionStorage.removeItem("__menu");
  function send(slug, extra = {}) {
    const data = { site: location.origin, title: document.title, ...extra, items: JSON.parse(sessionStorage.getItem("__menu") || "[]") };
    location.href = "http://127.0.0.1:4175/s/" + slug + "#" + encodeURIComponent(JSON.stringify(data));
  }
  return { run, scroll, links, reset, send };
})();
