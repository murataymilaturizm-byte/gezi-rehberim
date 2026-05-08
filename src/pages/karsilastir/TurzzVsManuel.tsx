import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, BarChart3 } from "lucide-react";

const schema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Manuel WhatsApp vs Turzz AI Chatbot — Detaylı Karşılaştırma",
  "description": "Seyahat acenteleri için manuel WhatsApp kullanımı ile Turzz AI chatbot arasındaki fark.",
  "author": { "@type": "Organization", "name": "Turzz AI" },
  "publisher": { "@type": "Organization", "name": "Turzz AI", "url": "https://turzzai.com" },
  "datePublished": "2026-05-07",
};

export default function TurzzVsManuel() {
  const { t } = useTranslation();
  const ns = "pages.karsilastir.turzzVsManuel";

  const rows       = t(`${ns}.comparisonSection.rows`,          { returnObjects: true }) as { topic: string; manual: string; ai: string }[];
  const cols       = t(`${ns}.comparisonSection.columns`,       { returnObjects: true }) as { topic: string; manual: string; ai: string };
  const manualItems = t(`${ns}.costSection.manualCard.items`,   { returnObjects: true }) as { label: string; value: string }[];
  const aiItems     = t(`${ns}.costSection.aiCard.items`,       { returnObjects: true }) as { label: string; value: string }[];

  return (
    <Layout>
      <SEOHead
        title={t(`${ns}.meta.title`)}
        description={t(`${ns}.meta.description`)}
        keywords={t(`${ns}.meta.keywords`)}
        canonical="/karsilastir/turzz-vs-manuel-whatsapp"
        schema={schema}
        type="article"
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50/50 to-background dark:from-slate-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-slate-100 text-slate-700 border-0">
            <BarChart3 className="w-3 h-3 mr-1" /> {t(`${ns}.badge`)}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            {t(`${ns}.hero.title1`)}{" "}
            <span className="text-orange-500">{t(`${ns}.hero.title2`)}</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t(`${ns}.hero.subtitle`)}
          </p>
        </div>
      </section>

      {/* Karşılaştırma Tablosu */}
      <section className="py-16 container mx-auto px-4 max-w-4xl">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">
          {t(`${ns}.comparisonSection.heading`)}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-card rounded-xl overflow-hidden shadow-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-4 text-sm font-semibold text-foreground">{cols.topic}</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">{cols.manual}</th>
                <th className="text-center p-4 text-sm font-semibold text-orange-500">{cols.ai}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="p-4 text-sm font-medium text-foreground">{row.topic}</td>
                  <td className="p-4 text-sm text-center">
                    <div className="flex items-center justify-center gap-1">
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="text-muted-foreground">{row.manual}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-foreground font-medium">{row.ai}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Maliyet Hesabı */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            {t(`${ns}.costSection.heading`)}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Manuel */}
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl p-6">
              <h3 className="font-bold text-foreground mb-4">{t(`${ns}.costSection.manualCard.heading`)}</h3>
              <div className="space-y-2 text-sm">
                {manualItems.map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
                <div className="border-t border-red-200 pt-2 flex justify-between font-bold">
                  <span className="text-foreground">{t(`${ns}.costSection.manualCard.totalLabel`)}</span>
                  <span className="text-red-500">{t(`${ns}.costSection.manualCard.totalValue`)}</span>
                </div>
              </div>
            </div>
            {/* AI */}
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-xl p-6">
              <h3 className="font-bold text-foreground mb-4">{t(`${ns}.costSection.aiCard.heading`)}</h3>
              <div className="space-y-2 text-sm">
                {aiItems.map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
                <div className="border-t border-green-200 pt-2 flex justify-between font-bold">
                  <span className="text-foreground">{t(`${ns}.costSection.aiCard.totalLabel`)}</span>
                  <span className="text-green-500">{t(`${ns}.costSection.aiCard.totalValue`)}</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-muted-foreground mt-6 text-sm">
            {t(`${ns}.costSection.savingsNote`)}
          </p>
        </div>
      </section>

      {/* Sonuç */}
      <section className="py-16 container mx-auto px-4 max-w-3xl text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t(`${ns}.conclusionSection.heading`)}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
          {t(`${ns}.conclusionSection.para1`)}
        </p>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          {t(`${ns}.conclusionSection.para2`)}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
            <Link to="/auth?mode=signup">{t(`${ns}.conclusionSection.ctaPrimary`)}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/whatsapp-chatbot-seyahat-acentesi">{t(`${ns}.conclusionSection.ctaSecondary`)}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
