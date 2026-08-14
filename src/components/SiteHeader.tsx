import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone } from "lucide-react";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toolsHubUrl } from "@/lib/tools/registry";

// SITE-MENU-1 — TEK HEADER.
// Bu bileşen TÜM public sayfaların tek header'ıdır (landing, blog, blog-detay,
// araçlar, yardım, hukuki sayfalar…). Sayfa-özel header YAZILMAZ; menüde bir
// değişiklik gerekiyorsa YALNIZ buradaki NAV_ITEMS düzenlenir.
// Panel (auth sonrası /admin) kapsam DIŞI — kendi düzeni devam eder.
//
// Menü kararları (2026-08-14):
//  · Kaynaklar-dropdown İPTAL → Blog ve Araçlar birinci seviye.
//  · Yardım menüden kalktı → footer'da yaşıyor.
//  · Fiyatlandırma menüden kalktı → SAYFA/BÖLÜM YAŞIYOR (footer + landing #pricing).
//    PayTR entegrasyonu tamamlandığında menüye geri dönecek.

const SUPPORT_PHONE_DISPLAY = "0850 242 77 50";
const SUPPORT_PHONE_HREF = "tel:+908502427750";

export interface NavItem {
  /** i18n anahtarı */
  key: string;
  /** Yol — landing anchor'ları "/#..." biçiminde */
  href: string;
  /** Aktiflik testi (yoksa href ile tam eşleşme) */
  isActive?: (pathname: string, hash: string) => boolean;
}

/**
 * TEK KAYNAK menü listesi — desktop ve mobil AYNI diziyi map'ler.
 * Ayrı mobil liste tutulmaz (eski Layout/Index ikilisinin sapma sebebi buydu).
 */
export function navItems(lang: string): NavItem[] {
  return [
    { key: "nav.home", href: "/", isActive: (p) => p === "/" },
    // "Özellikler" ürün bölümü = landing'in operasyon/özellik bölümü (anchor)
    { key: "nav.features", href: "/#operasyon", isActive: (p, h) => p === "/" && h === "#operasyon" },
    { key: "nav.blog", href: "/blog", isActive: (p) => /^\/(?:[a-z]{2}\/)?blog(?:\/|$)/.test(p) },
    { key: "nav.tools", href: toolsHubUrl(lang), isActive: (p) => /^\/(?:araclar|(?:en|de)\/tools)(?:\/|$)/.test(p) },
    { key: "nav.contact", href: "/#contact", isActive: (p, h) => p === "/" && h === "#contact" },
  ];
}

export function SiteHeader() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navItems(i18n.language);

  const isActive = (item: NavItem) =>
    item.isActive
      ? item.isActive(location.pathname, location.hash)
      : location.pathname === item.href;

  const linkCls = (active: boolean) =>
    `px-3 py-2 text-sm transition-colors ${
      active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="border-b border-border/50 bg-card/95 backdrop-blur-lg sticky top-0 z-50 shadow-sm no-print">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Turzz AI">
          <img src={turzzLogo} alt="Turzz AI Logo" className="h-10 w-auto" />
        </Link>

        {/* Desktop nav — tek kaynaktan */}
        <nav className="hidden lg:flex items-center gap-1" aria-label={t("nav.menu", { defaultValue: "Menü" })}>
          {items.map((item) => {
            const active = isActive(item);
            return item.href.startsWith("/#") ? (
              <a key={item.key} href={item.href} className={linkCls(active)} aria-current={active ? "page" : undefined}>
                {t(item.key)}
              </a>
            ) : (
              <Link key={item.key} to={item.href} className={linkCls(active)} aria-current={active ? "page" : undefined}>
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Destek telefonu — masaüstü numara, mobil ikon */}
          <a
            href={SUPPORT_PHONE_HREF}
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-1.5 text-sm text-foreground hover:text-primary transition-colors"
            aria-label={t("nav.callSupport", { defaultValue: "Destek Hattı" })}
          >
            <Phone className="h-4 w-4 text-primary" />
            <span className="font-medium tabular-nums">{SUPPORT_PHONE_DISPLAY}</span>
          </a>
          <a
            href={SUPPORT_PHONE_HREF}
            className="md:hidden inline-flex p-2 rounded-md hover:bg-accent transition-colors"
            aria-label={t("nav.callSupport", { defaultValue: "Destek Hattı" })}
            title={SUPPORT_PHONE_DISPLAY}
          >
            <Phone className="h-5 w-5 text-primary" />
          </a>
          {/* Dil + tema: mobilde çekmecede (360px'te CTA'ya yer açar) */}
          <div className="hidden lg:flex items-center gap-1">
            <LanguageSelector />
            <ThemeToggle />
          </div>
          <Button variant="ghost" asChild size="sm" className="hidden lg:inline-flex">
            <Link to="/auth">{t("nav.login")}</Link>
          </Button>
          <Button asChild size="sm" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90 text-white">
            <Link to="/auth?mode=signup">{t("nav.freeTrial")}</Link>
          </Button>

          <button
            className="lg:hidden p-2"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={t("nav.menu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobil menü — AYNI items dizisi (ikinci liste yok) */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-card px-4 py-3 space-y-1">
          {items.map((item) => {
            const active = isActive(item);
            const cls = `block py-2 text-sm ${active ? "text-primary font-semibold" : "hover:text-primary"}`;
            return item.href.startsWith("/#") ? (
              <a key={item.key} href={item.href} className={cls} onClick={() => setMobileOpen(false)} aria-current={active ? "page" : undefined}>
                {t(item.key)}
              </a>
            ) : (
              <Link key={item.key} to={item.href} className={cls} onClick={() => setMobileOpen(false)} aria-current={active ? "page" : undefined}>
                {t(item.key)}
              </Link>
            );
          })}
          <div className="border-t border-border pt-3 mt-2">
            <a href={SUPPORT_PHONE_HREF} className="block py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileOpen(false)}>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-primary" />
                {SUPPORT_PHONE_DISPLAY}
              </span>
            </a>
            <div className="flex items-center gap-2 py-2">
              <LanguageSelector />
              <ThemeToggle />
            </div>
            <Button variant="outline" asChild size="sm" className="w-full mt-1">
              <Link to="/auth" onClick={() => setMobileOpen(false)}>{t("nav.login")}</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
