// SEO Dalga 2a: pazarlama sitesinin dil seçicisi — TARANABİLİR.
// Eski LanguageSelector (Radix Select) seçenekleri yalnız açılınca DOM'a giriyordu ve
// <a href> değildi → crawler hiçbir dil bağlantısı görmüyordu; blog dışında URL'yi de
// değiştirmiyordu. Burada 7 dilin her biri prerender HTML'inde gerçek <a href>:
// o sayfanın diğer dildeki karşılığı, yoksa o dilin blog ana sayfası (lang-routing).
// Kendi yazısı olmayan dillere (ru/ar → noindex blog) rel="nofollow".
// Panel (Admin/Auth/ResetPassword) ve DemoChat eski LanguageSelector'ı kullanmaya devam eder
// (orada dil URL değil kullanıcı tercihi).
import { useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe, ChevronDown } from "lucide-react";
import { LANG_NATIVE, languageTargets } from "@/lib/lang-routing";

export function SiteLanguageMenu() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const ref = useRef<HTMLDetailsElement>(null);
  const targets = languageTargets(pathname);
  const current = targets.find((x) => x.isCurrent) ?? targets[0];
  // Seçim: menüyü kapat + tercihi sakla (panel açıldığında aynı dilde başlasın — eski davranış).
  const choose = (lang: string) => {
    if (ref.current) ref.current.open = false;
    try { localStorage.setItem("preferred-language", lang); } catch { /* depolama yoksa yok sayılır */ }
  };
  return (
    <details ref={ref} className="relative group">
      <summary
        className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5 h-9 px-3 rounded-md border border-border/50 bg-background/95 hover:bg-muted/50 cursor-pointer text-sm"
        aria-label={t("blog.languageMenu")}
      >
        <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span aria-hidden="true">{LANG_NATIVE[current.lang].flag}</span>
        <span className="hidden sm:inline">{LANG_NATIVE[current.lang].name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </summary>
      <ul className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-md border border-border/50 bg-background shadow-lg py-1">
        {targets.map((x) => (
          <li key={x.lang}>
            <Link
              to={x.href}
              hrefLang={x.lang}
              lang={x.lang}
              rel={x.indexable ? undefined : "nofollow"}
              aria-current={x.isCurrent ? "page" : undefined}
              onClick={() => choose(x.lang)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 ${x.isCurrent ? "font-semibold" : ""}`}
            >
              <span aria-hidden="true">{LANG_NATIVE[x.lang].flag}</span>
              <span>{LANG_NATIVE[x.lang].name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
