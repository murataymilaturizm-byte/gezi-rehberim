import { useTranslation } from "react-i18next";
import turzzLogo from "@/assets/turzz-logo-orange.png";

export const FooterSection = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border/50 bg-card/50 py-12 pb-24 md:pb-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Ürün */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">{t("footer.product")}</h4>
            <ul className="space-y-2">
              {[
                { href: "/whatsapp-chatbot-seyahat-acentesi", label: t("footer.whatsappChatbot") },
                { href: "/ai-tur-rezervasyonu", label: t("footer.aiReservation") },
                { href: "/cok-dilli-musteri-hizmetleri", label: t("footer.multilingualService") },
                { href: "/tur-otomasyonu", label: t("footer.tourAutomation") },
              ].map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
          {/* Çözümler */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">{t("footer.solutions")}</h4>
            <ul className="space-y-2">
              {[
                { href: "/cozum/incoming-acenteler", label: t("footer.incomingAgencies") },
                { href: "/cozum/gunubirlik-tur", label: t("footer.dayTours") },
                { href: "/cozum/butik-acenteler", label: t("footer.boutiqueAgencies") },
                { href: "/karsilastir/turzz-vs-manuel-whatsapp", label: t("footer.comparison") },
              ].map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
          {/* Şirket */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">{t("footer.company")}</h4>
            <ul className="space-y-2">
              {[
                { href: "/#hakkimizda", label: t("footer.about") },
                { href: "mailto:info@turzzai.com", label: t("footer.contact") },
                { href: "/privacy-policy", label: t("footer.kvkk") },
                { href: "/terms-of-service", label: t("footer.termsOfUse") },
                { href: "/data-deletion", label: t("footer.dataDeletion") },
                { href: "/data-export", label: t("footer.dataExport") },
              ].map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
          {/* Kaynaklar */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">{t("footer.resources")}</h4>
            <ul className="space-y-2">
              {[
                { href: "/blog", label: t("nav.blog") },
                { href: "/yardim", label: t("footer.helpCenter") },
                { href: "/nasil-baslarim", label: t("nav.gettingStarted") },
                { href: "/auth?mode=signup", label: t("footer.requestDemo") },
              ].map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={turzzLogo} alt="Turzz AI" className="h-8 w-auto" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
};
