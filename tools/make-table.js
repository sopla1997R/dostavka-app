// Builds the outreach table: leads/shops.json → leads/Магазины.xlsx (opens in Excel and Google Sheets).
// Usage: node tools/make-table.js [--ready]
// Statuses already typed into an existing xlsx are NOT read back: keep working in one copy of the table.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const root = path.join(__dirname, "..");
const SITE = "https://zakaz-app.github.io/dostavka-app/";
const all = JSON.parse(fs.readFileSync(path.join(root, "leads", "shops.json"), "utf8"));
const built = new Set(fs.existsSync(path.join(root, "docs")) ? fs.readdirSync(path.join(root, "docs")).filter(d => fs.existsSync(path.join(root, "docs", d, "index.html"))) : []);

// --ready: a short table with only the shops whose demo is already built
const onlyReady = process.argv.includes("--ready");
// --only=slug1,slug2 --name="Файл": a table for a hand-picked set of shops
const onlyArg = (process.argv.find(a => a.startsWith("--only=")) || "").slice(7);
const nameArg = (process.argv.find(a => a.startsWith("--name=")) || "").slice(7);
const pick = onlyArg ? onlyArg.split(",") : null;
const shops = pick ? pick.map(sl => all.find(s => s.slug === sl)).filter(Boolean) : onlyReady ? all.filter(s => built.has(s.slug)) : all;

const STATUSES = ["Не отправляли", "Отправили", "Ответили", "Думают", "Отказ", "Клиент"];
const COLS = [
  ["№", 5], ["Приоритет", 10], ["Город", 13], ["Название", 28], ["Тип", 24], ["Рейтинг", 8], ["Отзывов", 9], ["Точек", 7],
  ["Телефон", 18], ["WhatsApp", 16], ["Telegram", 20], ["ВКонтакте", 24], ["Сайт", 24], ["Почта", 24],
  ["Адрес", 30], ["Часы", 12], ["Демо", 12], ["Ссылка на демо", 46],
  ["Статус", 15], ["Дата отправки", 14], ["Кто отправил", 14], ["Комментарий", 40], ["2ГИС", 10]
];

const esc = s => String(s ?? "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const colName = i => { let s = ""; i++; while (i) { s = String.fromCharCode(65 + (i - 1) % 26) + s; i = Math.floor((i - 1) / 26); } return s; };
const txt = (v, style = 0) => ({ xml: v === "" || v == null ? "" : `t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${esc(v)}</t></is>` });
const num = v => ({ xml: v == null || v === "" ? "" : `><v>${v}</v>` });
const link = (url, label) => !url ? txt("") : ({ xml: `t="str" s="2"><f>HYPERLINK("${esc(String(url).replace(/"/g, '""'))}","${esc(String(label).replace(/"/g, '""'))}")</f><v>${esc(label)}</v>` });
const fmtPhone = p => { const d = String(p || "").replace(/\D/g, ""); return d.length === 11 ? `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}` : (p || ""); };
const short = u => String(u || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

const rows = [COLS.map(c => txt(c[0], 1))];
shops.forEach((s, i) => {
  const demoUrl = SITE + s.slug + "/";
  const ready = built.has(s.slug);
  rows.push([
    num(i + 1), txt(s.priority), txt(s.city), txt(s.name), txt(s.type), num(s.rating), num(s.reviews), num(s.branches),
    txt(s.phones.map(fmtPhone).join(", ")),
    link(s.wa ? "https://wa.me/" + s.wa : "", s.wa ? fmtPhone(s.wa) : ""),
    link(s.tg, short(s.tg).replace(/^t\.me\//, "@")), link(s.vk, short(s.vk)), link(s.site ? (/^http/.test(s.site) ? s.site : "http://" + s.site) : "", short(s.site)), txt(s.email),
    txt(s.addr), txt(s.hours), txt(ready ? "Готово" : "Нет"), ready ? link(demoUrl, short(demoUrl)) : txt(short(demoUrl)),
    txt("Не отправляли"), txt(""), txt(""), txt(s.note || ""), link(s.gis, "открыть")
  ]);
});

const last = rows.length;
const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane xSplit="4" ySplit="1" topLeftCell="E2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
<cols>${COLS.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c[1]}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => c.xml ? `<c r="${colName(ci)}${ri + 1}" ${c.xml}</c>` : "").join("")}</row>`).join("")}</sheetData>
<autoFilter ref="A1:${colName(COLS.length - 1)}${last}"/>
<dataValidations count="1"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="S2:S${Math.max(last, 2) + 300}"><formula1>"${STATUSES.join(",")}"</formula1></dataValidation></dataValidations>
</worksheet>`;

const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Магазины" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0B57D0"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF141414"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
  "xl/worksheets/sheet1.xml": sheet
};

// Minimal zip writer (deflate).
function zip(entries) {
  const parts = [], central = []; let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, "utf8"), data = Buffer.from(content, "utf8"), comp = zlib.deflateRawSync(data), crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0x00210000, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(0x00210000, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    parts.push(local, nameBuf, comp); central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22), n = Object.keys(entries).length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(n, 8); end.writeUInt16LE(n, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

const out = path.join(root, "leads", nameArg ? nameArg + ".xlsx" : onlyReady ? "Готовые демо.xlsx" : "Магазины.xlsx");
fs.writeFileSync(out, zip(files));
console.log(`table: ${out} · ${shops.length} shops · demos ready: ${shops.filter(s => built.has(s.slug)).length}`);
