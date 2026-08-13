import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertCircle, ArrowRight, BookOpen } from "lucide-react";
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

// SEO-BLOG-UI (d): seri-bandı metinleri — i18n dosya-çıkması yerine sayfa-içi
// kayıt (LANG_DISPLAY_NAMES emsali). M-serisinin kullanıcı-tarafı vitrini.
const SERIES_BAND: Record<string, { title: string; desc: string; cta: string }> = {
  tr: { title: "Acente Rehberi Serisi", desc: "Kuruluştan işleyen düzene: 10 makalelik yol haritası — kuruluş, WhatsApp, satış, reklam, iptal-iade, CRM.", cta: "Seriye başlayın" },
  en: { title: "The Agency Guide Series", desc: "From founding to a working routine: a 10-article roadmap — setup, WhatsApp, sales, ads, refunds, CRM.", cta: "Start the series" },
  de: { title: "Die Agentur-Leitfaden-Serie", desc: "Von der Gründung zum laufenden Betrieb: 10 Artikel — Gründung, WhatsApp, Verkauf, Werbung, Storno, CRM.", cta: "Serie starten" },
  ru: { title: "Серия руководств для агентств", desc: "От основания к работающей системе: 10 статей — запуск, WhatsApp, продажи, реклама, возвраты, CRM.", cta: "Начать серию" },
  ar: { title: "سلسلة أدلة الوكالات", desc: "من التأسيس إلى نظام عمل ناجح: خارطة طريق من 10 مقالات — التأسيس، واتساب، المبيعات، الإعلانات، الاسترداد، CRM.", cta: "ابدأ السلسلة" },
  fr: { title: "La série des guides d'agence", desc: "De la création à une routine qui fonctionne : 10 articles — création, WhatsApp, ventes, publicité, remboursements, CRM.", cta: "Commencer la série" },
  es: { title: "La serie de guías para agencias", desc: "De la fundación a una rutina que funciona: 10 artículos — creación, WhatsApp, ventas, anuncios, reembolsos, CRM.", cta: "Empezar la serie" },
};
const SERIES_START_SLUG = "seyahat-acentesi-nasil-acilir"; // M1

function PostMeta({ post, lang }: { post: BlogPost; lang: string }) {
  const { t } = useTranslation();
  const dateLocale = DATE_LOCALES[lang] || "en-GB";
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {new Date(post.date).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}
      </span>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {t("blog.minutesRead", { count: post.readingTime })}
      </span>
    </div>
  );
}

function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/60 rounded-full px-2.5 py-0.5">
      {category}
    </span>
  );
}

function FallbackStrip({ uiLang }: { uiLang: string }) {
  const { t } = useTranslation();
  return (
    <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2">
      <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
      <p className="text-xs text-amber-700 dark:text-amber-400">
        {t("blog.fallbackNotice", { lang: getLangDisplayName(uiLang, uiLang) })}
      </p>
    </div>
  );
}

// İŞ-1: TAM-KART TIKLANABİLİRLİK — kart tek <Link> ile sarılır (blok-link).
// Stretched-link overlay'i BİLİNÇLİ kullanılmadı: overlay metin-seçimini imkânsız
// kılar; blok-link'te tıkla-sürükle seçim çalışır ve tarayıcı sürüklemeyi tıklama
// saymaz. Kart içinde ikinci <a> YOK (readMore span'a indirildi — iç-içe <a> geçersizliği
// yok); erişilebilir ad aria-label={başlık}.
function BlogCard({ post, lang }: { post: BlogPost; lang: string }) {
  const { t, i18n } = useTranslation();

  return (
    <Link
      to={buildBlogUrl(lang, post.slug)}
      aria-label={post.title}
      className="block group h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg"
    >
      <Card className="h-full flex flex-col border-border/50 overflow-hidden transition-all duration-200 group-hover:border-orange-300 group-hover:shadow-lg group-hover:-translate-y-1 group-active:scale-[0.99]">
        {post.isFallback && <FallbackStrip uiLang={i18n.language} />}
        <BlogCoverImage title={post.title} category={post.category} image={post.image} size="card" />
        <CardContent className="p-5 flex flex-col flex-1">
          <div className="mb-2">
            <CategoryChip category={post.category} />
          </div>
          <h2 className="font-semibold text-foreground mb-2 line-clamp-2 leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
            {post.title}
          </h2>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{post.description}</p>
          <div className="mt-auto flex items-center justify-between gap-2">
            <PostMeta post={post} lang={lang} />
            <span className="text-sm text-orange-500 font-medium flex items-center gap-1 shrink-0">
              {t("blog.readMore")}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// İŞ-2 (a): öne-çıkan büyük kart — desktop'ta görsel sol / içerik sağ, mobilde dikey.
function FeaturedCard({ post, lang }: { post: BlogPost; lang: string }) {
  const { t, i18n } = useTranslation();

  return (
    <Link
      to={buildBlogUrl(lang, post.slug)}
      aria-label={post.title}
      className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl"
    >
      <Card className="overflow-hidden border-border/50 transition-all duration-200 group-hover:border-orange-300 group-hover:shadow-lg group-active:scale-[0.995]">
        {post.isFallback && <FallbackStrip uiLang={i18n.language} />}
        <div className="grid md:grid-cols-2">
          <BlogCoverImage title={post.title} category={post.category} image={post.image} size="card" className="md:rounded-none" />
          <CardContent className="p-6 md:p-8 flex flex-col justify-center">
            <div className="mb-3">
              <CategoryChip category={post.category} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3 line-clamp-3 leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
              {post.title}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground line-clamp-3 mb-4">{post.description}</p>
            <div className="flex items-center justify-between gap-2">
              <PostMeta post={post} lang={lang} />
              <span className="text-sm text-orange-500 font-medium flex items-center gap-1 shrink-0">
                {t("blog.readMore")}
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
              </span>
            </div>
          </CardContent>
        </div>
      </Card>
    </Link>
  );
}

// İŞ-2 (a): öne-çıkanın yanındaki 2 kompakt kart (görselsiz, hızlı-taranır satır)
function CompactCard({ post, lang }: { post: BlogPost; lang: string }) {
  const { i18n } = useTranslation();

  return (
    <Link
      to={buildBlogUrl(lang, post.slug)}
      aria-label={post.title}
      className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg"
    >
      <Card className="h-full border-border/50 transition-all duration-200 group-hover:border-orange-300 group-hover:shadow-md group-hover:-translate-y-0.5 group-active:scale-[0.99]">
        {post.isFallback && <FallbackStrip uiLang={i18n.language} />}
        <CardContent className="p-4">
          <div className="mb-2">
            <CategoryChip category={post.category} />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-2 leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
            {post.title}
          </h3>
          <PostMeta post={post} lang={lang} />
        </CardContent>
      </Card>
    </Link>
  );
}

// İŞ-2 (d): seri-bandı — M-kümesinin kullanıcı-tarafı vitrini
function SeriesBand({ lang }: { lang: string }) {
  const txt = SERIES_BAND[lang] || SERIES_BAND.tr;
  return (
    <Link
      to={buildBlogUrl(lang, SERIES_START_SLUG)}
      aria-label={txt.title}
      className="block group mb-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl"
    >
      <div className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 text-white px-5 py-4 md:px-8 md:py-5 flex items-center gap-4 transition-shadow group-hover:shadow-lg">
        <BookOpen className="w-8 h-8 shrink-0 opacity-90" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{txt.title}</p>
          <p className="text-sm text-white/85 line-clamp-2">{txt.desc}</p>
        </div>
        <span className="hidden sm:flex items-center gap-1 text-sm font-semibold bg-white/15 rounded-full px-4 py-2 shrink-0 transition-colors group-hover:bg-white/25">
          {txt.cta}
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </span>
      </div>
    </Link>
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

  // İŞ-2 (a): öne-çıkan = frontmatter featured:true (varsa) yoksa en-yeni.
  // Deterministik (prerender-güvenli): getAllPosts tarih-DESC sıralı döner.
  const showHero = activeCategory === ALL_CATEGORY && filtered.length >= 3;
  const featuredPost = showHero ? (filtered.find((p) => p.featured) ?? filtered[0]) : null;
  const sideBudget = showHero ? filtered.filter((p) => p !== featuredPost).slice(0, 2) : [];
  const gridPosts = showHero
    ? filtered.filter((p) => p !== featuredPost && !sideBudget.includes(p))
    : filtered;

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
        {/* İŞ-2 (c): kategori-filtresi — yatay chip-bar; mobilde kaydırılır, desktop'ta sarar */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible [scrollbar-width:thin]">
          <Button
            variant={activeCategory === ALL_CATEGORY ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(ALL_CATEGORY)}
            className={`rounded-full shrink-0 ${activeCategory === ALL_CATEGORY ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
          >
            {t("blog.categories.all")}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full shrink-0 ${activeCategory === cat ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* İŞ-2 (d): seri-bandı — yalnız tüm-liste görünümünde */}
        {activeCategory === ALL_CATEGORY && <SeriesBand lang={lang} />}

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {t("blog.noPosts")}
          </div>
        ) : (
          <>
            {/* İŞ-2 (a): öne-çıkan alan — 1 büyük + 2 kompakt */}
            {featuredPost && (
              <div className="grid lg:grid-cols-3 gap-6 mb-10">
                <div className="lg:col-span-2">
                  <FeaturedCard post={featuredPost} lang={lang} />
                </div>
                <div className="grid gap-6 content-start">
                  {sideBudget.map((post) => (
                    <CompactCard key={post.slug} post={post} lang={lang} />
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gridPosts.map((post) => (
                <BlogCard key={post.slug} post={post} lang={lang} />
              ))}
            </div>
          </>
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
