import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

import turzzLogo from "@/assets/turzz-logo-orange.png";
import { SiteHeader } from "@/components/SiteHeader";
import { toolsHubUrl } from "@/lib/tools/registry";

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
  const { t, i18n } = useTranslation();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

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
                <li><Link to={toolsHubUrl(i18n.language)} className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("nav.tools")}</Link></li>
                <li><Link to="/yardim" className="text-sm text-muted-foreground hover:text-primary transition-colors">Yardım Merkezi</Link></li>
                <li><Link to="/nasil-baslarim" className="text-sm text-muted-foreground hover:text-primary transition-colors">Nasıl Başlarım?</Link></li>
                {/* SITE-MENU-1: Fiyatlandırma menüden kalktı, buradan erişilir.
                    PayTR entegrasyonu tamamlandığında menüye geri dönecek. */}
                <li><Link to="/#pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("nav.pricing")}</Link></li>
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
