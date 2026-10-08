// SEO Dalga 2a (2026-10-08): sayfanın dili URL'den — RENDER ÖNCESİ, sayfa başına ayrı i18n örneği.
//
// KÖK: prerender'da i18n global örneği "tr" ile başlıyor, blog sayfaları dili yalnız
// useEffect içinde değiştiriyordu (sunucuda çalışmaz) → 82 yabancı sayfa <html lang="tr">,
// menü/footer/CTA TR basılıyordu.
//
// NEDEN KOPYA ÖRNEK: vite-react-ssg rotaları EŞZAMANLI render eder (concurrency 20).
// Render sırasında global örneğin dilini değiştirmek bir sayfanın diğerinin dilini almasına
// yol açar. Kopya örnek (i18nForLang) aynı çeviri deposunu paylaşır ama DİL DURUMU
// kendinedir; global örnek hiç değiştirilmez.
//
// Panel rotaları (/admin, /auth, /reset-password) URL'den dil almaz: kullanıcının
// kendi dil tercihi (global örnek + localStorage) aynen geçerli.
import { useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { isPanelPath, langFromPath } from "@/lib/lang-routing";
import { i18nForLang } from "@/lib/i18n-for-lang";

export function UrlLangProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const panel = isPanelPath(pathname);
  const lang = langFromPath(pathname);
  const instance = useMemo(() => (panel ? null : i18nForLang(lang)), [panel, lang]);
  if (!instance) return <>{children}</>;
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
