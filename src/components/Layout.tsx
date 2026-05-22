import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Menu, X } from "lucide-react";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { LanguageSelector } from "@/components/LanguageSelector";

const cozumler = [
  { href: "/cozum/incoming-acenteler", label: "Incoming Acenteler" },
  { href: "/cozum/gunubirlik-tur", label: "Günübirlik Tur Operatörleri" },
  { href: "/cozum/butik-acenteler", label: "Butik Acenteler" },
];

const ozellikler = [
  { href: "/whatsapp-chatbot-seyahat-acentesi", label: "WhatsApp Chatbot" },
  { href: "/ai-tur-rezervasyonu", label: "AI Tur Rezervasyonu" },
  { href: "/cok-dilli-musteri-hizmetleri", label: "Çok Dilli Hizmet" },
  { href: "/tur-otomasyonu", label: "Tur Otomasyonu" },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/95 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={turzzLogo} alt="Turzz AI Logo" className="h-10 w-auto" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent">{t("nav.features")}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="w-56 p-2">
                      {ozellikler.map((item) => (
                        <li key={item.href}>
                          <NavigationMenuLink asChild>
                            <Link
                              to={item.href}
                              className="block px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              {item.label}
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent">{t("nav.solutions")}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="w-64 p-2">
                      {cozumler.map((item) => (
                        <li key={item.href}>
                          <NavigationMenuLink asChild>
                            <Link
                              to={item.href}
                              className="block px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              {item.label}
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <Link to="/blog" className="px-3 py-2 text-sm hover:text-primary transition-colors">
              {t("nav.blog")}
            </Link>
            <Link to="/yardim" className="px-3 py-2 text-sm hover:text-primary transition-colors">
              {t("nav.help")}
            </Link>
            <Link to="/#pricing" className="px-3 py-2 text-sm hover:text-primary transition-colors">
              {t("nav.pricing")}
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <LanguageSelector />
            <Button variant="ghost" asChild size="sm">
              <Link to="/auth">{t("nav.login")}</Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90 text-white">
              <Link to="/auth?mode=signup">{t("nav.freeTrial")}</Link>
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={t("nav.menu")}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1">{t("nav.features")}</p>
            {ozellikler.map((item) => (
              <Link key={item.href} to={item.href} className="block py-2 text-sm hover:text-primary" onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            ))}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1 mt-2">{t("nav.solutions")}</p>
            {cozumler.map((item) => (
              <Link key={item.href} to={item.href} className="block py-2 text-sm hover:text-primary" onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className="border-t border-border pt-3 mt-2 space-y-1">
              <Link to="/blog" className="block py-2 text-sm hover:text-primary" onClick={() => setMobileOpen(false)}>{t("nav.blog")}</Link>
              <Link to="/yardim" className="block py-2 text-sm hover:text-primary" onClick={() => setMobileOpen(false)}>{t("nav.help")}</Link>
              <Link to="/#pricing" className="block py-2 text-sm hover:text-primary" onClick={() => setMobileOpen(false)}>{t("nav.pricing")}</Link>
            </div>
            <div className="pt-3">
              <LanguageSelector />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" asChild size="sm" className="flex-1">
                <Link to="/auth" onClick={() => setMobileOpen(false)}>{t("nav.login")}</Link>
              </Button>
              <Button asChild size="sm" className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <Link to="/auth?mode=signup" onClick={() => setMobileOpen(false)}>{t("nav.freeTrial")}</Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-foreground mb-3 text-sm">{t("footer.product")}</h3>
              <ul className="space-y-2">
                {ozellikler.map((item) => (
                  <li key={item.href}>
                    <Link to={item.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3 text-sm">{t("footer.solutions")}</h3>
              <ul className="space-y-2">
                {cozumler.map((item) => (
                  <li key={item.href}>
                    <Link to={item.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3 text-sm">{t("footer.company")}</h3>
              <ul className="space-y-2">
                <li><Link to="/#about" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("footer.about")}</Link></li>
                <li><a href="mailto:info@turzzai.com" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("footer.contact")}</a></li>
                <li><Link to="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("footer.kvkk")}</Link></li>
                <li><Link to="/terms-of-service" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("footer.termsOfUse")}</Link></li>
                <li><Link to="/data-deletion" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("footer.dataDeletion")}</Link></li>
                <li><Link to="/data-export" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("footer.dataExport")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3 text-sm">{t("footer.resources")}</h3>
              <ul className="space-y-2">
                <li><Link to="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">Blog</Link></li>
                <li><Link to="/yardim" className="text-sm text-muted-foreground hover:text-primary transition-colors">Yardım Merkezi</Link></li>
                <li><Link to="/nasil-baslarim" className="text-sm text-muted-foreground hover:text-primary transition-colors">Nasıl Başlarım?</Link></li>
                <li><Link to="/karsilastir/turzz-vs-manuel-whatsapp" className="text-sm text-muted-foreground hover:text-primary transition-colors">Karşılaştırma</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <Link to="/">
              <img src={turzzLogo} alt="Turzz AI" className="h-8 w-auto" />
            </Link>
            <p className="text-xs text-muted-foreground">
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
