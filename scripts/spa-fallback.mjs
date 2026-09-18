// SPA kabuğu + 404 sayfası üretici.
//
// 2026-07-25 (SSG) ORİJİNAL AMAÇ: vite-react-ssg dist/index.html'i PRERENDER'LI ANA
// SAYFA yapar. Panel rotaları (/admin, /auth, /reset-password) Vercel fallback'inde
// bu index.html'i alırsa hidrasyondan önce ANA SAYFA içeriği görünür (homepage flash).
// ÇÖZÜM: #root İÇERİĞİNİ boşalt → boş kabuk → istemci client-render yapar.
//
// 2026-09-18 (İNDEKSLEME DALGA-1) EKLENEN: #root boşaltmak YETMİYORDU — <head>
// aynen kalıyordu. Ölçüm (canlı): /bu-path-yok → HTTP 200 + ana sayfanın
// <title>'ı + <link rel="canonical" href="https://turzzai.com/">. Yani her
// bilinmeyen URL Google'a "ben aslında ana sayfayım" diyordu.
//   → GSC: "Duplicate, Google chose different canonical" (22 sayfa)
//   → GSC: "Discovered - currently not indexed" (91 sayfa)
// Artık head de temizleniyor ve İKİ dosya üretiliyor:
//   dist/spa-fallback.html → GEÇERLİ istemci rotaları (/admin, /auth, ...) — 200
//   dist/404.html          → bilinmeyen path'ler — Vercel 404 statüsüyle servis eder
//
// NOT: spa-fallback GEÇERLİ sayfalara hizmet ettiği için başlığı "Sayfa Bulunamadı"
// DEĞİL, nötr marka başlığıdır (/admin'i "bulunamadı" diye etiketlemek yanlış olurdu).
// 404.html "Sayfa Bulunamadı" başlığını taşır. İkisi de noindex ve canonical'sız.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const idxPath = join(dist, "index.html");
if (!existsSync(idxPath)) {
  console.warn("[spa-fallback] dist/index.html yok — atlandı.");
  process.exit(0);
}

const html = readFileSync(idxPath, "utf-8");

// ── 1) #root içeriğini boşalt (2026-07-25 mantığı, DEĞİŞMEDİ) ──────────────
const openMatch = html.match(/<div\s+id="root"[^>]*>/);
if (!openMatch) {
  console.warn("[spa-fallback] #root bulunamadı — atlandı.");
  process.exit(0);
}
const start = openMatch.index;
const afterOpen = start + openMatch[0].length;

const re = /<div\b[^>]*>|<\/div>/g;
re.lastIndex = afterOpen;
let depth = 1;
let closeStart = -1;
let m;
while ((m = re.exec(html))) {
  if (m[0] === "</div>") {
    depth--;
    if (depth === 0) { closeStart = m.index; break; }
  } else {
    depth++;
  }
}
if (closeStart === -1) {
  console.warn("[spa-fallback] #root kapanışı bulunamadı — atlandı.");
  process.exit(0);
}
const closeEnd = closeStart + "</div>".length;
const bosRoot = html.slice(0, start) + '<div id="root"></div>' + html.slice(closeEnd);

// ── 2) <head> temizliği ────────────────────────────────────────────────────
// ── Etiket sökücüler ───────────────────────────────────────────────────────
// REGEX KULLANILMIYOR: bu dosyaya blok yazarken ters-bölü kaçışları defalarca
// bozuldu (canlı kanıt: "application/ld+json" regex'i "Invalid flags" verdi).
// İndeks tabanlı sökme hem kaçışsız hem okunur.

/** İçinde `ara` geçen tüm <meta ...> etiketlerini söker. */
function silEtiket(s, baslangic, ara, bitis) {
  for (;;) {
    const k = s.indexOf(ara);
    if (k === -1) return s;
    const a = s.lastIndexOf(baslangic, k);
    if (a === -1) return s;
    const b = s.indexOf(bitis, k);
    if (b === -1) return s;
    s = s.slice(0, a) + s.slice(b + bitis.length);
  }
}

/** property="og:… / name="twitter:… gibi ÖNEKLİ meta'ları söker. */
function silMeta(s, onek) {
  s = silEtiket(s, "<meta", 'property="' + onek, ">");
  return silEtiket(s, "<meta", 'name="' + onek, ">");
}

/** name="description" gibi TAM adlı meta'ları söker. */
function silMetaAdi(s, ad) {
  return silEtiket(s, "<meta", 'name="' + ad + '"', ">");
}

/** JSON-LD script bloklarını söker. */
function silJsonLd(s) {
  return silEtiket(s, "<script", "application/ld+json", "</script>");
}
/**
 * Ana sayfadan miras kalan SEO etiketlerini söker, noindex + istenen başlığı basar.
 * Silinen sınıflar (hepsi ana sayfaya işaret ediyordu):
 *   rel="canonical" · og:url · og:title · og:description · og:image · twitter:*
 * KORUNAN: charset, viewport, script/link asset referansları, favicon, tema rengi.
 */
function headiTemizle(kaynak, baslik) {
  let s = kaynak;

  // canonical
  s = s.replace(/\s*<link\b[^>]*rel="canonical"[^>]*>/gi, "");
  // TÜM og:* ve twitter:* meta'ları. Kapsam bilinçli geniş: ilk turda yalnız
  // url/title/description/image siliniyordu, ama og:site_name / og:locale /
  // og:type de ana sayfanın kimliğini taşıyordu — kabukta hiçbiri anlamlı değil.
  s = silMeta(s, "og:");
  s = silMeta(s, "twitter:");
  // Ana sayfanın açıklaması/anahtar kelimeleri — kabukta duplicate sinyal üretir
  s = silMetaAdi(s, "description");
  s = silMetaAdi(s, "keywords");
  // JSON-LD: ana sayfanın FAQPage şeması kabukta kalıyordu → yanlış rich-result
  s = silJsonLd(s);
  // mevcut robots meta'sı varsa çıkar (tek robots satırı kalsın)
  s = s.replace(/\s*<meta\b[^>]*name="robots"[^>]*>/gi, "");

  // <title> değiştir (data-rh attribute'lu olabilir)
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(s)) {
    s = s.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${baslik}</title>`);
  } else {
    s = s.replace(/<head([^>]*)>/i, `<head$1><title>${baslik}</title>`);
  }

  // noindex ekle — <head> açılışının hemen ardına
  s = s.replace(/<head([^>]*)>/i, `<head$1><meta name="robots" content="noindex, nofollow">`);

  return s;
}

// ── 3) İki dosyayı yaz ─────────────────────────────────────────────────────
const APP_BASLIK = "Turzz AI";
const NF_BASLIK = "Sayfa Bulunamadı | Turzz AI";

writeFileSync(join(dist, "spa-fallback.html"), headiTemizle(bosRoot, APP_BASLIK), "utf-8");
writeFileSync(join(dist, "404.html"), headiTemizle(bosRoot, NF_BASLIK), "utf-8");

console.log("[spa-fallback] dist/spa-fallback.html (uygulama kabuğu, noindex) üretildi.");
console.log("[spa-fallback] dist/404.html (Sayfa Bulunamadı, noindex) üretildi.");
