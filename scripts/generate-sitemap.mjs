/**
 * Sitemap Generator — otomatik olarak build öncesinde çalışır.
 * src/blog/posts/tr/*.md dosyalarını tarar, frontmatter'dan slug ve
 * tarihi çeker, EN versiyonu varsa hreflang ekler, public/sitemap.xml üretir.
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

// ─── Statik sayfa listesi ──────────────────────────────────────────────────
// Yeni sayfa eklendiğinde buraya bir satır ekle.
const STATIC_PAGES = [
  { path: '/',                                        priority: '1.0', changefreq: 'weekly'  },
  { path: '/auth',                                    priority: '0.5', changefreq: 'monthly' },
  { path: '/whatsapp-chatbot-seyahat-acentesi',       priority: '0.9', changefreq: 'monthly' },
  { path: '/ai-tur-rezervasyonu',                     priority: '0.9', changefreq: 'monthly' },
  { path: '/cok-dilli-musteri-hizmetleri',            priority: '0.8', changefreq: 'monthly' },
  { path: '/tur-otomasyonu',                          priority: '0.8', changefreq: 'monthly' },
  { path: '/cozum/incoming-acenteler',                priority: '0.8', changefreq: 'monthly' },
  { path: '/cozum/gunubirlik-tur',                    priority: '0.8', changefreq: 'monthly' },
  { path: '/cozum/butik-acenteler',                   priority: '0.8', changefreq: 'monthly' },
  { path: '/karsilastir/turzz-vs-manuel-whatsapp',    priority: '0.8', changefreq: 'monthly' },
  { path: '/blog',                                    priority: '0.9', changefreq: 'weekly'  },
  { path: '/nasil-baslarim',                          priority: '0.7', changefreq: 'monthly' },
  { path: '/yardim',                                  priority: '0.7', changefreq: 'monthly' },
  { path: '/privacy-policy',                          priority: '0.3', changefreq: 'yearly'  },
  { path: '/terms-of-service',                        priority: '0.3', changefreq: 'yearly'  },
];

// ─── Frontmatter parser ────────────────────────────────────────────────────
// gray-matter dependency olmadan basit YAML frontmatter okur.
// Sadece tek-satırlık skaler değerleri (string, sayı) çeker.
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Tırnak işaretlerini kaldır
    value = value.replace(/^["']|["']$/g, '');
    if (key && value) result[key] = value;
  }
  return result;
}

// ─── Blog yazılarını tara ─────────────────────────────────────────────────
function getBlogPosts() {
  const trDir = join(ROOT, 'src/blog/posts/tr');
  const enDir = join(ROOT, 'src/blog/posts/en');

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

    const hasEn = existsSync(join(enDir, file));

    posts.push({
      slug:    fm.slug,
      lastmod: fm.date || TODAY,
      hasEn,
    });
  }

  // Tarihe göre sırala (yeniden eskiye)
  posts.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
  return posts;
}

// ─── XML yardımcı ─────────────────────────────────────────────────────────
function urlEntry({ loc, lastmod, changefreq, priority, hreflang }) {
  let entry = `  <url>\n`;
  entry += `    <loc>${loc}</loc>\n`;
  entry += `    <lastmod>${lastmod}</lastmod>\n`;
  entry += `    <changefreq>${changefreq}</changefreq>\n`;
  entry += `    <priority>${priority}</priority>\n`;

  if (hreflang) {
    entry += `    <xhtml:link rel="alternate" hreflang="tr"        href="${loc}"/>\n`;
    entry += `    <xhtml:link rel="alternate" hreflang="en"        href="${loc}"/>\n`;
    entry += `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>\n`;
  }

  entry += `  </url>\n`;
  return entry;
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────
function generateSitemap() {
  const posts = getBlogPosts();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n`;

  // Statik sayfalar
  xml += `  <!-- Statik sayfalar -->\n`;
  for (const page of STATIC_PAGES) {
    xml += urlEntry({
      loc:        `${SITE_URL}${page.path}`,
      lastmod:    TODAY,
      changefreq: page.changefreq,
      priority:   page.priority,
      hreflang:   false,
    });
  }

  // Blog yazıları
  xml += `\n  <!-- Blog yazıları (TR${posts.some(p => p.hasEn) ? ' + EN hreflang' : ''}) -->\n`;
  for (const post of posts) {
    xml += urlEntry({
      loc:        `${SITE_URL}/blog/${post.slug}`,
      lastmod:    post.lastmod,
      changefreq: 'monthly',
      priority:   '0.7',
      hreflang:   post.hasEn,
    });
  }

  xml += `</urlset>\n`;

  const outPath = join(ROOT, 'public/sitemap.xml');
  writeFileSync(outPath, xml, 'utf-8');

  const enCount = posts.filter(p => p.hasEn).length;
  console.log(`✅ Sitemap oluşturuldu: ${STATIC_PAGES.length} statik sayfa + ${posts.length} blog yazısı (${enCount} EN hreflang)`);
  console.log(`   → ${outPath}`);
}

generateSitemap();
