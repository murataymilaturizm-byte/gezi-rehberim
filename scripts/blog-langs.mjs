// TEK KAYNAK — "bir blog yazısı hangi dillerde GERÇEKTEN var?"
//
// KÖK (2026-09-18, GSC teşhisi): bu kural iki yerde ayrı ayrı yaşıyordu.
//   · sitemap  : existsSync(src/blog/posts/{lang}/{file})  → ru/ar 0 yazı
//   · Blog.tsx : getAllPosts() TR-fallback ile 30 yazı listeliyor
// İkisi aynı dizini okuyordu ama AYNI KURALI uygulamıyordu: liste, çevirisi
// olmayan dilde de /ru/blog/{slug} linki üretiyordu. O 60 URL prerender
// edilmiyor, sitemap'te yok → canlıda 200 + ana sayfa canonical'ı (soft 404).
//
// Bu modül Node tarafının (sitemap üretimi, testler) tek otoritesidir.
// Tarayıcı tarafının karşılığı src/lib/blog.ts → getAvailableLangsForSlug /
// postHref (bundler'da fs yok, import.meta.glob ile aynı dizini okur).
// İkisinin aynı sonucu verdiğini scripts/test_behavioral.ts kilitler.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const ALL_LANGS = ["tr", "en", "de", "ru", "ar", "fr", "es"];

/** Bir .md dosya adı için: hangi dillerde bu dosya var? */
export function availableLangsForFile(root, file) {
  return ALL_LANGS.filter((lang) => existsSync(join(root, `src/blog/posts/${lang}/${file}`)));
}

/** Bir dilde KENDİ yazısı var mı? (yoksa liste tamamen TR-fallback'tir) */
export function hasOwnPosts(root, lang) {
  const dir = join(root, `src/blog/posts/${lang}`);
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.endsWith(".md"));
}

/** Kendi yazısı olan diller — blog index'i sitemap'e girecek olanlar. */
export function langsWithPosts(root) {
  return ALL_LANGS.filter((l) => hasOwnPosts(root, l));
}
