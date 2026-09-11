#!/usr/bin/env node
/**
 * DUMAN TESTİ — sayfaları GERÇEKTEN render eder (Faz 0.5).
 *
 * NEDEN VAR: 2026-09-11'de canlıda "SiteHeader is not defined" çöküşü yaşandı.
 * Davranışsal suite'te `/<SiteHeader \/>/.test(src)` substring testi VARDI ve
 * GEÇİYORDU — çünkü JSX yazılmıştı, ama import yoktu. Aynı turda 4 araç
 * sayfasının CTA'sının canlıda BOŞ olduğu da ortaya çıktı (cta.heading yerine
 * cta.endTitle olmalıydı) — yine substring testinden kaçtı.
 *
 * Kural: "kod var mı?" testi yetmez. Sayfa açılacak, hata fırlatmayacak,
 * kritik metin alanları DOLU olacak.
 *
 * Kullanım:  node scripts/smoke_pages.cjs http://localhost:4173
 */
const puppeteer = require("puppeteer-core");

const BASE = process.argv[2] || "http://localhost:4173";
const CHROME = process.env.CHROME_PATH || "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";

/** Gezilecek rotalar. Sonuncusu KASITLI 404 — NotFound sayfasını render ettirir. */
const ROUTES = [
  "/", "/blog", "/araclar", "/yardim", "/nasil-baslarim",
  "/privacy-policy", "/terms-of-service", "/data-deletion", "/data-export",
  "/whatsapp-chatbot-seyahat-acentesi", "/ai-tur-rezervasyonu",
  "/cok-dilli-musteri-hizmetleri", "/tur-otomasyonu",
  "/blog/whatsappta-musteri-neden-cevapsiz-birakir",
  "/en/blog", "/de/blog",
  "/araclar/rehber-sozlesmesi-olusturucu",
  "/araclar/tur-kar-hesaplayici",
  "/araclar/tur-satis-sozlesmesi-olusturucu",
  "/araclar/tur-teklifi-olusturucu",
  "/araclar/transfer-sozlesmesi-olusturucu",
  "/bu-sayfa-yok-404-testi",            // ← NotFound
  "/turzz-com-iletisim",                 // ← eski turzz.com yolu (canlı vakası)
];

/** Araç sayfalarında CTA metinleri DOLU olmalı (boş CTA vakası) */
const TOOL_ROUTES = ROUTES.filter((r) => r.startsWith("/araclar/"));

let fail = 0;
const bad = (msg) => { console.log("  ✗ " + msg); fail++; };
const ok = (msg) => console.log("  ✓ " + msg);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new", args: ["--no-sandbox"],
  });
  console.log("── DUMAN TESTİ: " + ROUTES.length + " rota ──");

  for (const route of ROUTES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    // React hydration uyarıları (#418/#422/#423/#425) spa-fallback rotalarında
    // ÖNCEDEN BERİ var (/auth ve /admin dahil): boş #root kabuğu + hydrateRoot
    // tasarımının doğal sonucu, React client-render"a düşerek toparlıyor.
    // Bunlar AYRI kategoride raporlanır; gerçek çöküşleri (ReferenceError vb.)
    // maskelememek için diğer tüm hatalar SERT başarısızlık sayılır.
    const bilinen = [];
    page.on("pageerror", (e) => {
      const m = e.message;
      if (/Minified React error #(418|422|423|425)/.test(m)) bilinen.push("hydration");
      else errors.push("pageerror: " + m);
    });
    page.on("console", (m) => {
      if (m.type() === "error") {
        const t = m.text();
        // 404 rotasında bilerek console.error basılıyor — o beklenen
        if (!/404 Error: User attempted/.test(t)) errors.push("console: " + t.slice(0, 120));
      }
    });

    let status = 0;
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 45000 });
      status = resp ? resp.status() : 0;
    } catch (e) {
      bad(route + " — sayfa açılamadı: " + e.message.slice(0, 80));
      await page.close();
      continue;
    }
    await new Promise((r) => setTimeout(r, 900));

    const view = await page.evaluate(() => {
      const body = document.body.innerText || "";
      const ctaH2 = [...document.querySelectorAll("h2")]
        .map((h) => h.textContent.trim())
        .filter((t) => t.length === 0).length;
      return {
        bosH2: ctaH2,
        hataMetni: /Unexpected Application Error|is not defined|ReferenceError/.test(body),
        header: !!document.querySelector("header"),
        h1: (document.querySelector("h1") || {}).textContent || "",
        govde: body.trim().length,
      };
    });

    const sorunlar = [];
    if (errors.length) sorunlar.push(errors[0]);
    if (view.hataMetni) sorunlar.push("sayfada hata metni görünüyor");
    if (!view.header) sorunlar.push("header YOK");
    if (view.govde < 80) sorunlar.push("gövde neredeyse boş (" + view.govde + " karakter)");
    if (TOOL_ROUTES.includes(route) && view.bosH2 > 0) sorunlar.push("BOŞ <h2> var (" + view.bosH2 + " adet) — CTA metni gelmiyor olabilir");

    if (sorunlar.length) bad(route + " [" + status + "] → " + sorunlar.join(" · "));
    else ok(route + " [" + status + "] " + (view.h1 || "").slice(0, 40) + (bilinen.length ? "  (bilinen: hydration)" : ""));

    await page.close();
  }

  await browser.close();
  console.log(fail === 0 ? "\nDUMAN TESTİ GEÇTİ" : "\nDUMAN TESTİ BAŞARISIZ: " + fail + " sorun");
  process.exit(fail === 0 ? 0 : 1);
})();
