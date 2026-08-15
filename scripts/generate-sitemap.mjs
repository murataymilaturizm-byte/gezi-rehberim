/**
 * Sitemap Generator — otomatik olarak build öncesinde çalışır.
 * Tüm 7 dil için ayrı URL girişleri + doğru hreflang alternates üretir.
 *
 * Çalıştırma:
 *   npm run generate-sitemap   (manuel)
 *   npm run build              (prebuild ile otomatik)
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SITE_URL = 'https://turzzai.com';
const TODAY = new Date().toISOString().split('T')[0];
const ALL_LANGS = ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es'];

// ─── Statik sayfa listesi ──────────────────────────────────────────────────
// SEO-FIX (2026-07-10): /auth ÇIKARILDI (artık noindex — sitemap'te noindex-URL
// Search Console "gönderilen URL'de noindex" hatası üretir); /data-deletion +
// /data-export EKLENDİ (SEOHead'li indexlenebilir yasal sayfalar).
const STATIC_PAGES = [
  { path: '/',                                        priority: '1.0', changefreq: 'weekly'  },
  { path: '/whatsapp-chatbot-seyahat-acentesi',       priority: '0.9', changefreq: 'monthly' },
  { path: '/ai-tur-rezervasyonu',                     priority: '0.9', changefreq: 'monthly' },
  { path: '/cok-dilli-musteri-hizmetleri',            priority: '0.8', changefreq: 'monthly' },
  { path: '/tur-otomasyonu',                          priority: '0.8', changefreq: 'monthly' },
  
  
  
  
  // ARAÇ-1 — Araçlar bölümü. Bu liste aynı zamanda PRERENDER setidir
  // (vite.config.ts includedRoutes sitemap.xml'i okur) → hub + araç sayfası
  // iskeleti statik HTML'e girer, form client-mount olur.
  { path: '/araclar',                                 priority: '0.7', changefreq: 'monthly' },
  { path: '/araclar/rehber-sozlesmesi-olusturucu',    priority: '0.8', changefreq: 'monthly' },
  { path: '/araclar/tur-kar-hesaplayici',             priority: '0.8', changefreq: 'monthly' },
  { path: '/nasil-baslarim',                          priority: '0.7', changefreq: 'monthly' },
  { path: '/yardim',                                  priority: '0.7', changefreq: 'monthly' },
  { path: '/privacy-policy',                          priority: '0.3', changefreq: 'yearly'  },
  { path: '/terms-of-service',                        priority: '0.3', changefreq: 'yearly'  },
  { path: '/data-deletion',                           priority: '0.3', changefreq: 'yearly'  },
  { path: '/data-export',                             priority: '0.3', changefreq: 'yearly'  },
];

// ─── URL yardımcısı ────────────────────────────────────────────────────────
// TR prefix yok (default), diğerleri /lang/blog/...
function buildLangUrl(lang, slug) {
  const base = lang === 'tr' ? `${SITE_URL}/blog` : `${SITE_URL}/${lang}/blog`;
  return slug ? `${base}/${slug}` : base;
}

// ─── Frontmatter parser ────────────────────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    value = value.replace(/^["']|["']$/g, '');
    if (key && value) result[key] = value;
  }
  return result;
}

// ─── Blog yazılarını tara — tüm 7 dil ────────────────────────────────────
function getBlogPosts() {
  const trDir = join(ROOT, 'src/blog/posts/tr');
  if (!existsSync(trDir)) {
    console.warn('⚠️  src/blog/posts/tr dizini bulunamadı, blog yazıları atlanıyor.');
    return [];
  }

  const trFiles = readdirSync(trDir).filter(f => f.endsWith('.md'));

  const posts = [];
  for (const file of trFiles) {
    const content = readFileSync(join(trDir, file), 'utf-8');
    const fm = parseFrontmatter(content);
    if (!fm.slug) {
      console.warn(`⚠️  ${file}: slug bulunamadı, atlandı.`);
      continue;
    }

    // Hangi dillerde bu yazı mevcut?
    const availableLangs = ALL_LANGS.filter(lang =>
      existsSync(join(ROOT, `src/blog/posts/${lang}/${file}`))
    );

    posts.push({
      slug:           fm.slug,
      lastmod:        fm.updated || fm.date || TODAY, // SEO-1: updated öncelikli
      availableLangs,
    });
  }

  posts.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
  return posts;
}

// ─── XML yardımcı (statik sayfalar için) ──────────────────────────────────
function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>\n`;
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────
function generateSitemap() {
  const posts = getBlogPosts();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n`;

  // ── Statik sayfalar (TR) ──
  xml += `  <!-- Statik sayfalar -->\n`;
  for (const page of STATIC_PAGES) {
    xml += urlEntry({
      loc:        `${SITE_URL}${page.path}`,
      lastmod:    TODAY,
      changefreq: page.changefreq,
      priority:   page.priority,
    });
  }

  // ── Blog index sayfaları (her dil için) ──
  xml += `\n  <!-- Blog index sayfaları (7 dil) -->\n`;
  for (const lang of ALL_LANGS) {
    xml += urlEntry({
      loc:        buildLangUrl(lang),
      lastmod:    TODAY,
      changefreq: 'weekly',
      priority:   '0.8',
    });
  }

  // ── Blog yazıları — her dil için ayrı URL + hreflang alternates ──
  const totalEntries = posts.reduce((sum, p) => sum + p.availableLangs.length, 0);
  xml += `\n  <!-- Blog yazıları (${posts.length} yazı, ${totalEntries} URL girişi) -->\n`;

  for (const post of posts) {
    const langs = post.availableLangs;
    if (langs.length === 0) continue;

    // x-default: EN varsa EN, yoksa TR
    const xDefaultLang = langs.includes('en') ? 'en' : 'tr';

    for (const lang of langs) {
      const loc = buildLangUrl(lang, post.slug);

      xml += `  <url>\n`;
      xml += `    <loc>${loc}</loc>\n`;
      xml += `    <lastmod>${post.lastmod}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;

      // Mevcut diller için hreflang alternates
      for (const altLang of langs) {
        xml += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${buildLangUrl(altLang, post.slug)}"/>\n`;
      }
      // x-default
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${buildLangUrl(xDefaultLang, post.slug)}"/>\n`;

      xml += `  </url>\n`;
    }
  }

  xml += `</urlset>\n`;

  const outPath = join(ROOT, 'public/sitemap.xml');
  writeFileSync(outPath, xml, 'utf-8');

  const langStats = ALL_LANGS.map(l => `${l}:${posts.filter(p => p.availableLangs.includes(l)).length}`).join(' ');
  console.log(`✅ Sitemap oluşturuldu:`);
  console.log(`   ${STATIC_PAGES.length} statik + ${ALL_LANGS.length} blog-index + ${totalEntries} blog URL girişi`);
  console.log(`   Dil dağılımı: ${langStats}`);
  console.log(`   → ${outPath}`);
}

generateSitemap();
