// SEO Dalga 2a: görünür, taranabilir dil bağlantıları — sayfanın indexlenebilir dil
// karşılıklarına <a href> (hreflang seti ile AYNI kaynak: pageAlternates). Karşılık yoksa
// hiçbir şey basmaz. TR blog'dan yabancı karşılıklara (ve tersi) link verir.
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { LANG_NATIVE, SITE_LANGS, langFromPath, pageAlternates } from "@/lib/lang-routing";

export function OtherLanguageLinks({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const self = langFromPath(pathname);
  const alts = pageAlternates(pathname);
  const others = SITE_LANGS.filter((l) => l !== self && alts[l]);
  if (!alts[self] || others.length === 0) return null;
  return (
    <nav aria-label={t("blog.otherLanguages")} className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground ${className}`}>
      <Globe className="w-4 h-4" aria-hidden="true" />
      <span>{t("blog.otherLanguages")}</span>
      {others.map((l, i) => (
        <span key={l} className="inline-flex items-center gap-2">
          <Link to={alts[l]} hrefLang={l} lang={l} className="text-orange-600 hover:underline">
            {LANG_NATIVE[l].name}
          </Link>
          {i < others.length - 1 && <span aria-hidden="true">·</span>}
        </span>
      ))}
    </nav>
  );
}
