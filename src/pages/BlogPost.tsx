import { useEffect } from "react";
import { useParams, Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowLeft, Share2, Tag, AlertCircle, List, MessageCircle, Linkedin } from "lucide-react";
import { getPostBySlug, getAllPosts, getAvailableLangsForSlug, type BlogPost } from "@/lib/blog";
import { BlogCoverImage } from "@/components/BlogCoverImage";
// SEO-1 (2026-08-12): anatomi tek-kaynak — TOC/CTA/paylaşım/okuma-süresi.
// Şablon TEK olduğu için 84+ posta otomatik uygulanır; prerender statik kalır
// (TOC <details> vanilla, CTA'lar akış-içi statik kutular → CLS üretmez).
import { extractToc, splitForMidCta, slugifyHeading, ctaTexts, DEMO_WA_URL, SIGNUP_URL } from "@/lib/blog-anatomy";

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

// SEO-1: ilgili-yazılar artık makale SONUNDA 3 KART. Eşleştirme bilinçli basit:
// aynı kategori; yetmezse EN YENİ postlarla doldurulur (benzerlik algoritması YOK).
function RelatedPostCards({ current, lang }: { current: BlogPost; lang: string }) {
  const { t } = useTranslation();
  const all = getAllPosts(lang).filter((p) => p.slug !== current.slug);
  const sameCat = all.filter((p) => p.category === current.category);
  const fill = all.filter((p) => p.category !== current.category);
  const related = [...sameCat, ...fill].slice(0, 3);
  if (related.length === 0) return null;
  return (
    <section className="mt-10 pt-8 border-t border-border">
      <h2 className="font-bold text-foreground mb-4 text-lg">{ctaTexts(lang).relatedTitle}</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {related.map((p) => (
          <Link key={p.slug} to={buildBlogUrl(lang, p.slug)}
            className="block group rounded-xl border border-border bg-card p-4 hover:border-orange-300 hover:shadow-sm transition-all">
            <Badge variant="outline" className="text-[10px] mb-2">{p.category}</Badge>
            <p className="text-sm font-semibold text-foreground group-hover:text-orange-500 transition-colors line-clamp-2 min-h-[2.5rem]">{p.title}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {t("blog.minutesRead", { count: p.readingTime })}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// SEO-1: TOC — mobil <details> (varsayılan KAPALI, vanilla, JS'siz), desktop
// hep-açık ayrı <nav>. Tek <details>'i CSS ile desktop'ta zorla açmak modern
// Chrome'da çalışmıyor (content-visibility:hidden) → iki küçük render bilinçli.
function TocBlock({ items, lang }: { items: ReturnType<typeof extractToc>; lang: string }) {
  if (items.length < 2) return null;
  const T = ctaTexts(lang);
  const List_ = (
    <ol className="space-y-1.5 text-sm">
      {items.map((h) => (
        <li key={h.id} className={h.level === 3 ? "ml-4" : ""}>
          <a href={`#${h.id}`} className="text-muted-foreground hover:text-orange-500 transition-colors">
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <>
      <details className="lg:hidden mb-6 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <summary className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer select-none">
          <List className="w-4 h-4" /> {T.tocTitle}
        </summary>
        <div className="mt-3">{List_}</div>
      </details>
      <nav aria-label={T.tocTitle} className="hidden lg:block mb-8 rounded-xl border border-border bg-muted/40 px-5 py-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <List className="w-4 h-4" /> {T.tocTitle}
        </p>
        {List_}
      </nav>
    </>
  );
}

// SEO-1: paylaşım — WhatsApp + LinkedIn (hafif, statik <a>).
function ShareRow({ url, title, lang, compact }: { url: string; title: string; lang: string; compact?: boolean }) {
  const T = ctaTexts(lang);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  return (
    <div className={`flex gap-2 ${compact ? "" : "mt-4"}`}>
      <Button asChild variant="outline" size="sm">
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={T.shareWhatsApp}>
          <MessageCircle className="w-4 h-4 mr-1 text-green-600" /> WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={li} target="_blank" rel="noopener noreferrer" aria-label={T.shareLinkedIn}>
          <Linkedin className="w-4 h-4 mr-1 text-sky-600" /> LinkedIn
        </a>
      </Button>
    </div>
  );
}

// SEO-1: makale-ORTASI kompakt CTA — sabit yapı (rezerve alan, CLS üretmez).
function MidCta({ lang }: { lang: string }) {
  const T = ctaTexts(lang);
  return (
    <div className="my-8 rounded-xl border-2 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 px-5 py-4 not-prose">
      <p className="text-sm font-semibold text-foreground mb-3">{T.midTitle}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="bg-green-600 hover:bg-green-700 text-white">
          <a href={DEMO_WA_URL} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-4 h-4 mr-1" /> {T.midBtn}
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={SIGNUP_URL}>{T.midSecondary}</Link>
        </Button>
      </div>
    </div>
  );
}

// SEO-1: makale-SONU tam-genişlik dönüşüm kutusu.
function EndCta({ lang }: { lang: string }) {
  const T = ctaTexts(lang);
  return (
    <div className="mt-10 rounded-2xl border-2 border-orange-300 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 px-6 py-6 text-center">
      <h2 className="text-xl font-bold text-foreground mb-2">{T.endTitle}</h2>
      <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-4">{T.endDesc}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
          <a href={DEMO_WA_URL} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-4 h-4 mr-2" /> {T.endBtn}
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link to={SIGNUP_URL}>{T.endSecondary}</Link>
        </Button>
      </div>
    </div>
  );
}

// SEO-1: H2/H3'e otomatik id — TOC anchor'ları. Hiyerarşi DEĞİŞMEZ (yalnız id).
function headingText(children: unknown): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(headingText).join("");
  if (children && typeof children === "object" && "props" in (children as any)) {
    return headingText((children as any).props?.children);
  }
  return "";
}
const MD_COMPONENTS = {
  h2: ({ children }: any) => <h2 id={slugifyHeading(headingText(children))}>{children}</h2>,
  h3: ({ children }: any) => <h3 id={slugifyHeading(headingText(children))}>{children}</h3>,
};

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

  // SEO-1: dateModified/timeRequired/wordCount ile zenginleştirildi.
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.description,
    "image": `https://turzzai.com${post.image}`,
    "author": { "@type": "Organization", "name": post.author },
    "publisher": { "@type": "Organization", "name": "Turzz AI", "url": "https://turzzai.com" },
    "datePublished": post.date,
    "dateModified": post.updated || post.date,
    "timeRequired": `PT${post.readingTime}M`,
    "wordCount": post.wordCount,
    "keywords": post.tags.join(", "),
    "inLanguage": post.lang,
  };

  // SEO-1: anatomi hesapları (build-time; prerender'da statik HTML'e gömülür).
  const toc = extractToc(post.content);
  const [contentA, contentB] = splitForMidCta(post.content);
  const T = ctaTexts(lang);

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
                {post.updated && (
                  <span className="flex items-center gap-1">
                    {T.updatedLabel}: {new Date(post.updated).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
                <span>{post.author}</span>
                {post.isFallback && (
                  <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                    {t("blog.fallbackBadge")}
                  </Badge>
                )}
              </div>
            </header>

            <ShareRow url={shareUrl} title={post.title} lang={lang} compact />

            <BlogCoverImage
              title={post.title}
              category={post.category}
              image={post.image}
              size="hero"
              className="mb-8 mt-4"
            />

            <TocBlock items={toc} lang={lang} />

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
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {contentA}
              </ReactMarkdown>
              {contentB && (
                <>
                  <MidCta lang={lang} />
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                    {contentB}
                  </ReactMarkdown>
                </>
              )}
            </div>

            <EndCta lang={lang} />

            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
              {post.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                  <Tag className="w-3 h-3" />{tag}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-4 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.share?.({ title: post.title, url: shareUrl }) || window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`, "_blank")}
              >
                <Share2 className="w-4 h-4 mr-1" /> {t("blog.post.share")}
              </Button>
              <ShareRow url={shareUrl} title={post.title} lang={lang} compact />
            </div>

            <RelatedPostCards current={post} lang={lang} />
          </article>

          <aside className="lg:w-72 space-y-8">

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
