// SEO Dalga 2a — prerender DİL KAPISI (postbuild). dist/ çıktısını sitemap'e karşı doğrular.
//
// Bu aynı zamanda EŞZAMANLILIK testidir: vite-react-ssg 148 sayfayı tek koşumda, 20'şerli
// eşzamanlı ve sitemap sırasıyla (aynı yazının tr/en/de/fr/es sürümleri art arda → aynı
// partide) üretir. Bir sayfa başka sayfanın dilini alırsa <html lang>, og:locale, menü ve
// footer metni URL diliyle uyuşmaz → kapı kırmızı (build başarısız, deploy olmaz).
//
// Kontroller (her sitemap URL'si):
//  1. <html lang> = URL dili; ar ise dir="rtl"
//  2. og:locale = dilin locale'i
//  3. menü "Ana Sayfa" (nav.home) + footer telif (footer.copyright) + yazıda "Paylaş"
//     (blog.post.share) + yazı sonu CTA (blog.post.ctaTitle) metni O DİLİN locale değeri
//  4. head hreflang seti = sitemap xhtml:link seti; yalnız sitemap'teki (indexlenebilir) URL'lere
//     işaret eder; ru/ar yok; x-default = TR; karşılıklı (her üye aynı seti basar)
//  5. dil menüsü: 7 dilin her biri <a href hreflang=…> olarak HTML'de; menü Blog linki dilin blog'u
// Çıkış kodu: hata varsa 1.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const SITE = "https://turzzai.com";
const OG = { tr: "tr_TR", en: "en_US", de: "de_DE", ru: "ru_RU", ar: "ar_SA", fr: "fr_FR", es: "es_ES" };
const PREFIX = ["en", "de", "ru", "ar", "fr", "es"];
const ALL = ["tr", ...PREFIX];

const loc = Object.fromEntries(ALL.map((l) => [l, JSON.parse(readFileSync(join(ROOT, `src/i18n/locales/${l}.json`), "utf8").replace(/^﻿/, ""))]));
const get = (o, k) => k.split(".").reduce((a, x) => (a == null ? a : a[x]), o);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const has = (html, s) => html.includes(s) || html.includes(esc(s));

const xml = readFileSync(join(ROOT, "public/sitemap.xml"), "utf8");
const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
  loc: m[1].match(/<loc>(.*?)<\/loc>/)[1],
  alts: [...m[1].matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((a) => `${a[1]}=${a[2]}`).sort(),
}));
const inSitemap = new Set(entries.map((e) => e.loc));

const langOf = (p) => (PREFIX.includes(p.split("/")[1]) ? p.split("/")[1] : "tr");
const fileFor = (p) => {
  const c = [join(DIST, p === "/" ? "index.html" : `${p}.html`), join(DIST, p, "index.html")];
  return c.find(existsSync);
};
const headOf = (h) => h.split("</head>")[0];
const hreflangSet = (head) => [
  ...[...head.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"/gi)].map((a) => `${a[1]}=${a[2]}`),
  ...[...head.matchAll(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*hreflang="([^"]+)"/gi)].map((a) => `${a[2]}=${a[1]}`),
].filter((v, i, a) => a.indexOf(v) === i).sort();

const errors = [];
const sets = {};
const stats = { pages: 0, langOk: 0, ogOk: 0, chromeOk: 0, hlPages: 0, menuLinks: 0 };
for (const e of entries) {
  const p = e.loc.replace(SITE, "") || "/";
  const lang = langOf(p);
  const f = fileFor(p);
  if (!f) { errors.push(`${p}: dist dosyası yok`); continue; }
  const html = readFileSync(f, "utf8");
  const head = headOf(html);
  stats.pages++;
  const htmlLang = (html.match(/<html[^>]*\blang="([^"]*)"/i) || [])[1];
  const dir = (html.match(/<html[^>]*\bdir="([^"]*)"/i) || [])[1];
  if (htmlLang === lang && (lang !== "ar" || dir === "rtl")) stats.langOk++; else errors.push(`${p}: <html lang="${htmlLang}" dir="${dir}"> — beklenen ${lang}`);
  const og = (head.match(/property="og:locale"[^>]*content="([^"]*)"/) || head.match(/content="([^"]*)"[^>]*property="og:locale"/) || [])[1];
  if (og === OG[lang]) stats.ogOk++; else errors.push(`${p}: og:locale=${og} — beklenen ${OG[lang]}`);
  // menü / footer / yazı parçaları O DİLDE
  // Ortak Layout footer'ı (yardım/yasal sayfalar footer'sız; /nasil-baslarim kendi i18n'li
  // footer'ını kullanır). Ayırt edici: Layout footer'ı /data-export bağlantısı taşır.
  const need = [get(loc[lang], "nav.home")];
  const footer = (html.match(/<footer\b[\s\S]*?<\/footer>/) || [""])[0];
  if (footer.includes('href="/data-export"')) need.push(String(get(loc[lang], "footer.copyright") || "").replace("{{year}}", String(new Date().getFullYear())));
  const isPost = /\/blog\/[^/]+$/.test(p);
  if (isPost) need.push(get(loc[lang], "blog.post.share"), get(loc[lang], "blog.post.ctaTitle"));
  const missing = need.filter((s) => s && !has(html, s));
  if (missing.length === 0) stats.chromeOk++; else errors.push(`${p}: ${lang} arayüz metni yok: ${missing.map((s) => JSON.stringify(s)).join(", ")}`);
  // TR sızıntısı: yabancı sayfada TR menü/telif metni olmamalı
  if (lang !== "tr" && has(html, get(loc.tr, "nav.home")) && get(loc.tr, "nav.home") !== get(loc[lang], "nav.home")) errors.push(`${p}: TR menü metni ("${get(loc.tr, "nav.home")}") sızmış`);
  // hreflang
  const hs = hreflangSet(head);
  sets[e.loc] = hs;
  if (hs.length) stats.hlPages++;
  if (hs.join("|") !== e.alts.join("|")) errors.push(`${p}: head hreflang ≠ sitemap\n   head:    ${hs.join(" ")}\n   sitemap: ${e.alts.join(" ")}`);
  for (const h of hs) {
    const [hl, href] = h.split("=");
    if (hl === "ru" || hl === "ar") errors.push(`${p}: hreflang ${hl} (noindex dil)`);
    if (!inSitemap.has(href)) errors.push(`${p}: hreflang ${hl} → sitemap dışı ${href}`);
  }
  if (hs.length && !hs.some((h) => h.startsWith("x-default="))) errors.push(`${p}: x-default yok`);
  const xd = hs.find((h) => h.startsWith("x-default="));
  if (xd && langOf(xd.split("=")[1].replace(SITE, "") || "/") !== "tr") errors.push(`${p}: x-default TR değil (${xd})`);
  // dil menüsü: 7 dil <a href hreflang>
  const menuLangs = new Set([...html.matchAll(/<a\b[^>]*\bhref(?:lang)?="[^"]*"[^>]*hreflang="([a-z]{2})"/gi)].map((m) => m[1])
    .concat([...html.matchAll(/<a\b[^>]*\bhreflang="([a-z]{2})"[^>]*href="[^"]*"/gi)].map((m) => m[1])));
  if (ALL.every((l) => menuLangs.has(l))) stats.menuLinks++; else errors.push(`${p}: dil menüsünde eksik <a hreflang>: ${ALL.filter((l) => !menuLangs.has(l)).join(",")}`);
}
// karşılıklılık: her setin her üyesi aynı seti basmalı
let reciprocalBroken = 0;
for (const [u, hs] of Object.entries(sets)) {
  for (const h of hs) {
    const href = h.split("=")[1];
    if (sets[href] && sets[href].join("|") !== hs.join("|")) { reciprocalBroken++; if (reciprocalBroken < 5) errors.push(`karşılıklılık: ${u} ↔ ${href} setleri farklı`); }
  }
}
console.log(`[check-prerender-lang] sayfa=${stats.pages} lang-doğru=${stats.langOk} og:locale-doğru=${stats.ogOk} arayüz-dili-doğru=${stats.chromeOk} hreflang'lı=${stats.hlPages} dil-menüsü-7-dil=${stats.menuLinks} karşılıklılık-bozuk=${reciprocalBroken}`);
if (errors.length) {
  console.error(`[check-prerender-lang] ${errors.length} HATA:\n- ` + errors.slice(0, 40).join("\n- "));
  process.exit(1);
}
console.log("[check-prerender-lang] TAMAM — her sayfa kendi dilinde, hreflang seti karşılıklı ve yalnız indexlenebilir URL'lere.");
