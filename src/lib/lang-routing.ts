// TEK KAYNAK — "bu sayfa hangi dilde, başka hangi dillerde (indexlenebilir) karşılığı var?"
//
// SEO Dalga 2a (2026-10-08, docs/raporlar/TURZZAI-SEO-DALGA2-TESHIS.md):
//  - Sayfanın dili URL'den gelir (/en/…, /de/… ; önek yoksa tr). Prerender'da i18n
//    effect'leri çalışmadığı için dil eskiden hep "tr" basılıyordu (<html lang>, menü…).
//  - hreflang YALNIZ gerçekten var olan ve indexlenebilir karşılıklara işaret eder:
//    ru/ar blog'u noindex (kendi yazısı yok) → hiçbir sette yok; olmayan /en ana sayfası yok.
//  - x-default = TR karşılığı. Her sayfa aynı fonksiyondan aynı seti üretir → karşılıklı.
//  - Dil seçici: o sayfanın diğer dildeki karşılığı; yoksa o dilin blog ana sayfası.
// Node/sitemap karşılığı: scripts/generate-sitemap.mjs (aynı kural; test_behavioral kilitler).
import { getAvailableLangsForSlug, hasOwnPosts } from "./blog";

export const SITE_LANGS = ["tr", "en", "de", "ru", "ar", "fr", "es"] as const;
const PREFIX_LANGS = SITE_LANGS.filter((l) => l !== "tr");
export const SITE_URL = "https://turzzai.com";

/** URL'deki dil (önek yoksa tr). */
export function langFromPath(pathname: string): string {
  const seg = pathname.split("/")[1] ?? "";
  return (PREFIX_LANGS as readonly string[]).includes(seg) ? seg : "tr";
}

/** Panel rotaları URL'den dil almaz — kullanıcının kendi dil tercihi (global i18n) geçerli. */
export function isPanelPath(pathname: string): boolean {
  return /^\/(?:admin|auth|reset-password)(?:\/|$)/.test(pathname);
}

/** Blog'u indexlenebilir diller (kendi yazısı olanlar): tr, en, de, fr, es. */
export function indexableBlogLangs(): string[] {
  return SITE_LANGS.filter((l) => hasOwnPosts(l));
}

export function blogIndexPath(lang: string): string {
  return lang === "tr" ? "/blog" : `/${lang}/blog`;
}

export function blogPostPath(lang: string, slug: string): string {
  return `${blogIndexPath(lang)}/${slug}`;
}

/** Menüdeki Blog bağlantısı: sayfa dilinin blog'u indexlenebilirse o, değilse TR blog. */
export function menuBlogHref(lang: string): string {
  return hasOwnPosts(lang) ? blogIndexPath(lang) : "/blog";
}

const BLOG_INDEX_RE = /^(?:\/([a-z]{2}))?\/blog\/?$/;
const BLOG_POST_RE = /^(?:\/([a-z]{2}))?\/blog\/([^/]+)\/?$/;

/**
 * Sayfanın indexlenebilir dil karşılıkları (kendisi dahil): { dil: yol }.
 * Blog yazısı → yazının var olduğu indexlenebilir diller; blog ana sayfası → kendi yazısı
 * olan diller; diğer sayfalar → karşılık yok (yalnız TR URL'leri var).
 */
export function pageAlternates(pathname: string): Record<string, string> {
  const blogLangs = indexableBlogLangs();
  const post = pathname.match(BLOG_POST_RE);
  if (post) {
    const slug = decodeURIComponent(post[2]);
    const langs = getAvailableLangsForSlug(slug).filter((l) => blogLangs.includes(l));
    return Object.fromEntries(langs.map((l) => [l, blogPostPath(l, slug)]));
  }
  if (BLOG_INDEX_RE.test(pathname)) {
    return Object.fromEntries(blogLangs.map((l) => [l, blogIndexPath(l)]));
  }
  return {};
}

export interface HreflangLink { rel: "alternate"; hreflang: string; href: string }

/**
 * <head> hreflang seti. Sayfanın kendisi bu setin üyesi değilse (ör. noindex ru/ar blog'u)
 * hiç basılmaz. En az iki dil yoksa basılmaz. x-default = TR karşılığı (TR yoksa basılmaz).
 */
export function hreflangLinks(pathname: string): HreflangLink[] {
  const alts = pageAlternates(pathname);
  const self = langFromPath(pathname);
  if (!alts[self] || Object.keys(alts).length < 2) return [];
  const links: HreflangLink[] = SITE_LANGS.filter((l) => alts[l]).map((l) => ({ rel: "alternate", hreflang: l, href: SITE_URL + alts[l] }));
  if (alts.tr) links.push({ rel: "alternate", hreflang: "x-default", href: SITE_URL + alts.tr });
  return links;
}

export interface LangTarget { lang: string; href: string; indexable: boolean; isCurrent: boolean }

/** Dil seçici hedefleri (7 dil): karşılık varsa o, yoksa o dilin blog ana sayfası. */
export function languageTargets(pathname: string): LangTarget[] {
  const alts = pageAlternates(pathname);
  const self = langFromPath(pathname);
  return SITE_LANGS.map((l) => {
    const href = alts[l] ?? blogIndexPath(l);
    return { lang: l, href, indexable: !!alts[l] || hasOwnPosts(l), isCurrent: l === self };
  });
}

/** Dillerin kendi dilindeki adları (dil seçici ve "diğer dillerde" satırı). */
export const LANG_NATIVE: Record<string, { name: string; flag: string }> = {
  tr: { name: "Türkçe", flag: "🇹🇷" },
  en: { name: "English", flag: "🇬🇧" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  ru: { name: "Русский", flag: "🇷🇺" },
  ar: { name: "العربية", flag: "🇸🇦" },
  fr: { name: "Français", flag: "🇫🇷" },
  es: { name: "Español", flag: "🇪🇸" },
};

/** og:locale (IETF BCP 47). */
export const OG_LOCALE: Record<string, string> = {
  tr: "tr_TR", en: "en_US", de: "de_DE", ru: "ru_RU", ar: "ar_SA", fr: "fr_FR", es: "es_ES",
};
