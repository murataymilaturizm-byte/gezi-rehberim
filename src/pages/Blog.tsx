import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Tag, AlertCircle } from "lucide-react";
import { getAllPosts, getAllCategories, type BlogPost } from "@/lib/blog";
import { BlogCoverImage } from "@/components/BlogCoverImage";

const schema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "name": "Turzz AI Blog",
  "description": "Seyahat acenteleri için WhatsApp chatbot, AI turizm teknolojisi ve dijital dönüşüm rehberleri.",
  "url": "https://turzzai.com/blog",
  "publisher": { "@type": "Organization", "name": "Turzz AI" },
};

const SUPPORTED_LANGS = ["tr", "en", "de", "ru", "ar", "fr", "es"];

/** URL'den dil kodunu çıkarır. /en/blog → "en", /blog → null (TR default) */
function getLangFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/([a-z]{2})\//);
  return m && SUPPORTED_LANGS.includes(m[1]) ? m[1] : null;
}

/** Blog URL'si oluşturur. TR prefix'siz, diğerleri prefix'li. */
function buildBlogUrl(lang: string, slug?: string): string {
  const base = lang === "tr" ? "/blog" : `/${lang}/blog`;
  return slug ? `${base}/${slug}` : base;
}

const DATE_LOCALES: Record<string, string> = {
  tr: "tr-TR", en: "en-GB", de: "de-DE", ru: "ru-RU",
  ar: "ar-SA", fr: "fr-FR", es: "es-ES",
};

const LANG_DISPLAY_NAMES: Record<string, Record<string, string>> = {
  tr: { tr: "Türkçe", en: "İngilizce", de: "Almanca", ru: "Rusça", ar: "Arapça", fr: "Fransızca", es: "İspanyolca" },
  en: { tr: "Turkish", en: "English", de: "German", ru: "Russian", ar: "Arabic", fr: "French", es: "Spanish" },
  de: { tr: "Türkisch", en: "Englisch", de: "Deutsch", ru: "Russisch", ar: "Arabisch", fr: "Französisch", es: "Spanisch" },
  ru: { tr: "Турецкий", en: "Английский", de: "Немецкий", ru: "Русский", ar: "Арабский", fr: "Французский", es: "Испанский" },
  ar: { tr: "التركية", en: "الإنجليزية", de: "الألمانية", ru: "الروسية", ar: "العربية", fr: "الفرنسية", es: "الإسبانية" },
  fr: { tr: "Turc", en: "Anglais", de: "Allemand", ru: "Russe", ar: "Arabe", fr: "Français", es: "Espagnol" },
  es: { tr: "Turco", en: "Inglés", de: "Alemán", ru: "Ruso", ar: "Árabe", fr: "Francés", es: "Español" },
};

function getLangDisplayName(uiLang: string, targetLang: string): string {
  return LANG_DISPLAY_NAMES[uiLang]?.[targetLang] ?? targetLang.toUpperCase();
}

function BlogCard({ post, lang }: { post: BlogPost; lang: string }) {
  const { t } = useTranslation();
  const dateLocale = DATE_LOCALES[lang] || "en-GB";

  return (
    <Card className="border-border/50 hover:border-orange-300 transition-all hover:-translate-y-0.5 overflow-hidden">
      {post.isFallback && (
        <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t("blog.fallbackNotice", { lang: getLangDisplayName(i18n.language, i18n.language) })}
          </p>
        </div>
      )}
      <BlogCoverImage
        title={post.title}
        category={post.category}
        image={post.image}
        size="card"
      />
      <CardContent className="p-5">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(post.date).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t("blog.minutesRead", { count: post.readingTime })}
          </span>
        </div>
        <h2 className="font-semibold text-foreground mb-2 line-clamp-2 leading-snug">
          {post.title}
        </h2>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{post.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {post.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Tag className="w-2.5 h-2.5" />{tag}
              </span>
            ))}
          </div>
          <Link to={buildBlogUrl(lang, post.slug)} className="text-sm text-orange-500 hover:underline font-medium">
            {t("blog.readMore")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

const ALL_CATEGORY = "__all__";

export default function Blog() {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  // URL'den dili al (örn: /en/blog → "en"), yoksa i18n diline bak
  const urlLang = getLangFromPath(location.pathname);
  const lang = urlLang ?? i18n.language ?? "tr";

  // URL'deki dil i18n state'iyle farklıysa senkronize et
  useEffect(() => {
    if (urlLang && urlLang !== i18n.language) {
      i18n.changeLanguage(urlLang);
    }
  }, [urlLang, i18n]);

  const allPosts: BlogPost[] = useMemo(() => {
    try { return getAllPosts(lang); }
    catch (err) { console.error("Blog posts yüklenemedi:", err); return []; }
  }, [lang]);

  const categories = useMemo(() => getAllCategories(lang), [lang]);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);

  const filtered = activeCategory === ALL_CATEGORY
    ? allPosts
    : allPosts.filter((p) => p.category === activeCategory);

  const hasFallbacks = allPosts.some((p) => p.isFallback);

  return (
    <Layout>
      <SEOHead
        title="Blog — WhatsApp Chatbot ve Turizm Teknolojisi Rehberleri"
        description="Seyahat acenteleri için WhatsApp chatbot rehberleri, AI turizm teknolojisi, dijital dönüşüm ipuçları. Turzz AI Blog."
        keywords="whatsapp chatbot blog, turizm teknolojisi, seyahat acentesi dijital dönüşüm, tur yazılımı rehber"
        canonical={buildBlogUrl(lang)}
        schema={schema}
      />

      <section className="py-12 bg-gradient-to-b from-orange-50/30 to-background dark:from-orange-950/10">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Turzz AI Blog</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Seyahat acenteleri için WhatsApp chatbot, AI teknolojisi ve dijital dönüşüm rehberleri.
          </p>
        </div>
      </section>

      {/* Fallback uyarısı — tüm içerik TR'den geliyor */}
      {hasFallbacks && lang !== "tr" && (
        <div className="container mx-auto px-4 max-w-5xl mt-4">
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {t("blog.fallbackNotice", { lang: getLangDisplayName(lang, lang) })}
            </p>
          </div>
        </div>
      )}

      <section className="py-8 container mx-auto px-4 max-w-5xl">
        <div className="flex gap-2 flex-wrap mb-8">
          <Button
            variant={activeCategory === ALL_CATEGORY ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(ALL_CATEGORY)}
            className={activeCategory === ALL_CATEGORY ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
          >
            {t("blog.categories.all")}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className={activeCategory === cat ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            >
              {cat}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {t("blog.noPosts")}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((post) => (
              <BlogCard key={post.slug} post={post} lang={lang} />
            ))}
          </div>
        )}
      </section>

      <section className="py-12 bg-muted/30 text-center">
        <div className="container mx-auto px-4">
          <p className="text-muted-foreground mb-4">{t("blog.ctaQuestion")}</p>
          <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
            <Link to="/auth?mode=signup">{t("blog.ctaButton")}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
