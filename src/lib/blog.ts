// Blog utility — browser-compatible multilingual parser

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  image: string;
  author: string;
  readingTime: number;
  /** SEO-1: opsiyonel güncelleme tarihi (frontmatter `updated`) — schema dateModified */
  updated?: string;
  /** SEO-BLOG-UI: liste-sayfası öne-çıkan alanı için editör-seçimi (frontmatter `featured: true`).
   *  Hiçbir postta yoksa en yeni post öne çıkar. */
  featured?: boolean;
  wordCount: number;
  content: string;
  lang: string;
  isFallback?: boolean;
  originalLang?: string;
}

// --- Minimal frontmatter parser (browser compatible) ---

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  if (!raw.trimStart().startsWith("---")) {
    return { data: {}, content: raw };
  }

  const afterFirst = raw.trimStart().slice(3);
  const endIdx = afterFirst.indexOf("\n---");
  if (endIdx === -1) {
    return { data: {}, content: raw };
  }

  const yaml = afterFirst.slice(0, endIdx).trim();
  const body = afterFirst.slice(endIdx + 4).trim();

  const data: Record<string, unknown> = {};

  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      data[key] = rawVal
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }

    const unquoted = rawVal.replace(/^["']|["']$/g, "");

    if (unquoted !== "" && !isNaN(Number(unquoted))) {
      data[key] = Number(unquoted);
      continue;
    }

    data[key] = unquoted;
  }

  return { data, content: body };
}

// --- Per-language module maps (must be static strings for Vite) ---

const modulesTr = import.meta.glob("../blog/posts/tr/*.md", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

const modulesEn = import.meta.glob("../blog/posts/en/*.md", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

const modulesDe = import.meta.glob("../blog/posts/de/*.md", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

const modulesRu = import.meta.glob("../blog/posts/ru/*.md", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

const modulesAr = import.meta.glob("../blog/posts/ar/*.md", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

const modulesFr = import.meta.glob("../blog/posts/fr/*.md", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

const modulesEs = import.meta.glob("../blog/posts/es/*.md", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

const LANG_MODULES: Record<string, Record<string, string>> = {
  tr: modulesTr,
  en: modulesEn,
  de: modulesDe,
  ru: modulesRu,
  ar: modulesAr,
  fr: modulesFr,
  es: modulesEs,
};

function parsePost(raw: string, slug: string, lang: string, isFallback = false, originalLang?: string): BlogPost {
  const { data, content } = parseFrontmatter(raw);
  // SEO-M1: HTML-yorumları (iç-link işaretleri vb.) render'a GİTMEZ —
  // react-markdown yorumu escape'li GÖRÜNÜR metin basıyordu. Kaynak .md'de
  // işaret durur (M2/M4/M5 bağlanırken görülür), içerikten burada temizlenir.
  const cleanContent = content.replace(/<!--[\s\S]*?-->/g, "");
  const wordCount = content.split(/\s+/).length;

  return {
    slug,
    title:       (data.title as string)       ?? "Başlıksız",
    description: (data.description as string) ?? "",
    date:        String(data.date             ?? ""),
    category:    (data.category as string)    ?? "Genel",
    tags:        (data.tags as string[])      ?? [],
    image:       (data.image as string)       ?? "/blog/default.jpg",
    author:      (data.author as string)      ?? "Turzz AI",
    // SEO Dalga 2a: frontmatter "11 dk" / "11 min" gibi METİN → sayı. Birim i18n'den
    // (t("blog.minutesRead")) gelir; eskiden metin olduğu gibi basılıyordu ("11 dk min read").
    readingTime: parseInt(String(data.readingTime ?? ""), 10) || Math.ceil(wordCount / 200),
    updated:     data.updated ? String(data.updated) : undefined,
    // parser boolean üretmez ("true" string kalır) → iki biçim de kabul
    featured:    data.featured === true || data.featured === "true" || undefined,
    wordCount,
    content: cleanContent,
    lang,
    isFallback,
    originalLang,
  };
}

function getModulesForLang(lang: string): Record<string, string> {
  return LANG_MODULES[lang] ?? {};
}

function slugFromPath(path: string, lang: string): string {
  return path.replace(`../blog/posts/${lang}/`, "").replace(".md", "");
}

// --- Public API ---

export function getAllPosts(lang = "tr"): BlogPost[] {
  const mods = getModulesForLang(lang);
  const entries = Object.entries(mods);

  if (entries.length > 0) {
    return entries
      .map(([path, raw]) => {
        try {
          return parsePost(raw, slugFromPath(path, lang), lang);
        } catch {
          return null;
        }
      })
      .filter((p): p is BlogPost => p !== null)
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
  }

  // Fallback to TR
  if (lang !== "tr") {
    return getAllPosts("tr").map((p) => ({ ...p, lang, isFallback: true, originalLang: "tr" }));
  }

  return [];
}

export function getPostBySlug(slug: string, lang = "tr"): BlogPost | undefined {
  // Try requested language first
  const mods = getModulesForLang(lang);
  const key = `../blog/posts/${lang}/${slug}.md`;
  const raw = mods[key];

  if (raw) {
    try {
      return parsePost(raw, slug, lang);
    } catch {
      return undefined;
    }
  }

  // Fallback to TR
  if (lang !== "tr") {
    const trKey = `../blog/posts/tr/${slug}.md`;
    const trRaw = modulesTr[trKey];
    if (trRaw) {
      try {
        return parsePost(trRaw, slug, "tr", true, "tr");
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

export function getAllCategories(lang = "tr"): string[] {
  return [...new Set(getAllPosts(lang).map((p) => p.category))];
}

/** Returns all langs that have a post for the given slug */
/**
 * TEK KAYNAK — bir yazının HANGİ DİLDEKİ URL'ine link verilmeli.
 *
 * KÖK (2026-09-18, GSC teşhisi): blog listesi ru/ar gibi çevirisi OLMAYAN
 * dillerde TR-fallback ile 30 yazıyı listeliyor ve her birine /ru/blog/{slug}
 * linki veriyordu. O 60 URL prerender EDİLMİYOR, sitemap'te YOK → canlıda
 * HTTP 200 + ana sayfa canonical'ı dönüyordu (soft 404 + duplicate canonical).
 *
 * Kural: link YALNIZ .md dosyası GERÇEKTEN var olan dile verilir. Çeviri yoksa
 * yazının kendi dilindeki (TR) URL'ine düşülür — kullanıcı çalışan sayfaya iner,
 * Google ölü URL görmez. Aynı kuralın sitemap karşılığı:
 * scripts/generate-sitemap.mjs (availableLangs) — ikisi scripts/blog-langs.mjs
 * ile aynı dizin gerçeğini okur; test_behavioral.ts ikisinin aynı kaldığını kilitler.
 */
export function postHref(slug: string, uiLang: string): string {
  const mevcut = getAvailableLangsForSlug(slug);
  const hedef = mevcut.includes(uiLang) ? uiLang : (mevcut.includes("tr") ? "tr" : mevcut[0]);
  if (!hedef) return "/blog";
  return hedef === "tr" ? `/blog/${slug}` : `/${hedef}/blog/${slug}`;
}

/** Bu dilde HİÇ kendi yazısı var mı (yoksa liste tamamen TR-fallback demektir). */
export function hasOwnPosts(lang: string): boolean {
  return Object.keys(LANG_MODULES[lang] ?? {}).length > 0;
}

export function getAvailableLangsForSlug(slug: string): string[] {
  return Object.keys(LANG_MODULES).filter((lang) => {
    const key = `../blog/posts/${lang}/${slug}.md`;
    return !!LANG_MODULES[lang][key];
  });
}
