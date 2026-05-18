import { useEffect } from "react";
import { useParams, Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowLeft, Share2, Tag, AlertCircle } from "lucide-react";
import { getPostBySlug, getAllPosts, getAvailableLangsForSlug, type BlogPost } from "@/lib/blog";
import { BlogCoverImage } from "@/components/BlogCoverImage";

const SUPPORTED_LANGS = ["tr", "en", "de", "ru", "ar", "fr", "es"];

function getLangFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/([a-z]{2})\//);
  return m && SUPPORTED_LANGS.includes(m[1]) ? m[1] : null;
}

/** Blog URL'si oluşturur: TR prefix'siz, diğerleri prefix'li */
function buildBlogUrl(lang: string, slug?: string): string {
  const base = lang === "tr" ? "/blog" : `/${lang}/blog`;
  return slug ? `${base}/${slug}` : base;
}

/** Tam URL (hreflang ve canonical için) */
function buildAbsoluteBlogUrl(lang: string, slug: string): string {
  return `https://turzzai.com${buildBlogUrl(lang, slug)}`;
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

function RelatedPosts({ current, lang }: { current: BlogPost; lang: string }) {
  const { t } = useTranslation();
  const related = getAllPosts(lang)
    .filter((p) => p.slug !== current.slug && p.category === current.category)
    .slice(0, 3);
  if (related.length === 0) return null;
  return (
    <aside>
      <h3 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">
        {t("blog.post.relatedPosts")}
      </h3>
      <ul className="space-y-3">
        {related.map((p) => (
          <li key={p.slug}>
            <Link to={buildBlogUrl(lang, p.slug)} className="block group">
              <p className="text-sm font-medium text-foreground group-hover:text-orange-500 transition-colors line-clamp-2">{p.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("blog.minutesRead", { count: p.readingTime })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function BlogPost() {
  const { t, i18n } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  // Tüm hook'lar early return'dan ÖNCE çağrılmalı
  const urlLang = getLangFromPath(location.pathname);
  const lang = urlLang ?? i18n.language ?? "tr";

  useEffect(() => {
    if (urlLang && urlLang !== i18n.language) {
      i18n.changeLanguage(urlLang);
    }
  }, [urlLang, i18n]);

  if (!slug) return <Navigate to="/blog" replace />;

  const post = getPostBySlug(slug, lang);
  if (!post) return <Navigate to="/blog" replace />;

  const dateLocale = DATE_LOCALES[lang] || "en-GB";
  const availableLangs = getAvailableLangsForSlug(slug);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.description,
    "image": `https://turzzai.com${post.image}`,
    "author": { "@type": "Organization", "name": post.author },
    "publisher": { "@type": "Organization", "name": "Turzz AI", "url": "https://turzzai.com" },
    "datePublished": post.date,
    "keywords": post.tags.join(", "),
    "inLanguage": post.lang,
  };

  // Hreflang: her dil kendi URL'ine işaret eder (artık tümü aynı URL değil)
  const hreflangLinks = [
    ...availableLangs.map((l) => ({
      rel: "alternate",
      hreflang: l,
      href: buildAbsoluteBlogUrl(l, slug),
    })),
    // x-default: TR veya EN — hangisi varsa (Google için önemli)
    {
      rel: "alternate",
      hreflang: "x-default",
      href: buildAbsoluteBlogUrl(availableLangs.includes("en") ? "en" : "tr", slug),
    },
  ];

  const shareUrl = buildAbsoluteBlogUrl(lang, slug);

  return (
    <Layout>
      <SEOHead
        title={post.title}
        description={post.description}
        keywords={post.tags.join(", ")}
        ogImage={`https://turzzai.com${post.image}`}
        canonical={buildBlogUrl(lang, slug)}
        schema={schema}
        type="article"
        extraLinks={hreflangLinks}
      />

      <div className="container mx-auto px-4 max-w-6xl py-8">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-orange-500 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("blog.post.backToBlog")}
        </Link>

        {/* Fallback uyarı bandı */}
        {post.isFallback && lang !== "tr" && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t("blog.fallbackNotice", { lang: getLangDisplayName(lang, lang) })}
              </p>
              {availableLangs.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {t("blog.availableIn")} {availableLangs.map((l) => getLangDisplayName(lang, l)).join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-10">
          <article className="flex-1 min-w-0">
            <header className="mb-8">
              <Badge className="mb-3 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-0">
                {post.category}
              </Badge>
              <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight mb-4">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(post.date).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {t("blog.minutesRead", { count: post.readingTime })}
                </span>
                <span>{post.author}</span>
                {post.isFallback && (
                  <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                    {t("blog.fallbackBadge")}
                  </Badge>
                )}
              </div>
            </header>

            <BlogCoverImage
              title={post.title}
              category={post.category}
              image={post.image}
              size="hero"
              className="mb-8"
            />

            <div className="prose prose-lg prose-slate dark:prose-invert max-w-none
              prose-h1:text-3xl prose-h1:font-bold prose-h1:text-foreground
              prose-h2:text-2xl prose-h2:font-bold prose-h2:text-foreground prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-xl prose-h3:font-semibold prose-h3:text-foreground
              prose-p:text-foreground/80 prose-p:leading-relaxed
              prose-a:text-orange-500 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
              prose-strong:text-foreground prose-strong:font-semibold
              prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
              prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
              prose-blockquote:border-l-4 prose-blockquote:border-orange-400 prose-blockquote:text-muted-foreground prose-blockquote:italic
              prose-ul:list-disc prose-ol:list-decimal
              prose-li:text-foreground/80
              prose-img:rounded-lg prose-img:w-full
              prose-hr:border-border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {post.content}
              </ReactMarkdown>
            </div>

            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
              {post.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                  <Tag className="w-3 h-3" />{tag}
                </span>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.share?.({ title: post.title, url: shareUrl }) || window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`, "_blank")}
              >
                <Share2 className="w-4 h-4 mr-1" /> {t("blog.post.share")}
              </Button>
            </div>
          </article>

          <aside className="lg:w-72 space-y-8">
            <RelatedPosts current={post} lang={lang} />

            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2 text-sm">{t("blog.post.ctaTitle")}</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {t("blog.post.ctaDesc")}
              </p>
              <Button asChild size="sm" className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                <Link to="/auth?mode=signup">{t("blog.post.ctaButton")}</Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
