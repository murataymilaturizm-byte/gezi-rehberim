// SPA kabuğu üretici (2026-07-25 SSG) — panel rotaları için boş-#root fallback.
// SORUN: vite-react-ssg dist/index.html'i PRERENDER'LI ANA SAYFA yapar. Panel
// rotaları (/admin, /auth, /reset-password sitemap'te YOK → prerender yok) Vercel
// fallback'inde bu index.html'i alırsa istemci hidrasyondan önce ANA SAYFA içeriği
// görünür (homepage flash) → "panel davranışı değişmez" ihlali.
// ÇÖZÜM: dist/index.html'i kopyala, #root İÇERİĞİNİ boşalt (script/asset linkleri
// KALIR) → dist/spa-fallback.html. vercel.json panel rotalarını buraya rewrite eder.
// İstemci boş #root görünce client-render yapar (hidrasyon değil) → flash YOK, panel
// davranışı aynen SPA.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const idxPath = join(dist, "index.html");
if (!existsSync(idxPath)) {
  console.warn("[spa-fallback] dist/index.html yok — atlandı.");
  process.exit(0);
}

const html = readFileSync(idxPath, "utf-8");
// Açılış etiketi attribute'lu olabilir: <div id="root" data-server-rendered="true">
const openMatch = html.match(/<div\s+id="root"[^>]*>/);
if (!openMatch) {
  console.warn("[spa-fallback] #root bulunamadı — atlandı.");
  process.exit(0);
}
const start = openMatch.index;
const afterOpen = start + openMatch[0].length;

// #root'un kapanış </div>'ini derinlik sayarak bul (React çıktısında div-içi-div güvenli).
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

// Tüm <div id="root" ...>...</div> bloğunu temiz boş root ile değiştir (data-server-
// rendered YOK → istemci client-render yapar, empty-root hidrasyon uyuşmazlığı olmaz).
const closeEnd = closeStart + "</div>".length;
const shell = html.slice(0, start) + '<div id="root"></div>' + html.slice(closeEnd);
writeFileSync(join(dist, "spa-fallback.html"), shell, "utf-8");
console.log("[spa-fallback] dist/spa-fallback.html üretildi (boş #root SPA kabuğu).");
