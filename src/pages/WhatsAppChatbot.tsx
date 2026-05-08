import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, MessageCircle, Globe, Clock, TrendingUp, Zap, Users, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Turzz AI WhatsApp Chatbot",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "2999", "priceCurrency": "TRY", "priceValidUntil": "2027-01-01" },
  "provider": { "@type": "Organization", "name": "Turzz AI", "url": "https://turzzai.com" }
};

const FEATURE_ICONS = [Bot, Globe, Clock, TrendingUp, Users, Zap];

export default function WhatsAppChatbot() {
  const { t } = useTranslation();
  const wb = "pages.whatsappBot";

  const features = t(`${wb}.featuresSection.items`, { returnObjects: true }) as { title: string; description: string }[];
  const steps   = t(`${wb}.howSection.steps`,        { returnObjects: true }) as { title: string; description: string }[];
  const stats   = t(`${wb}.whySection.stats`,        { returnObjects: true }) as { value: string; text: string }[];
  const rows    = t(`${wb}.comparisonSection.rows`,   { returnObjects: true }) as { topic: string; manual: string; chatbot: string }[];
  const links   = t(`${wb}.relatedSection.links`,    { returnObjects: true }) as { title: string; description: string }[];
  const cols    = t(`${wb}.comparisonSection.columns`, { returnObjects: true }) as { topic: string; manual: string; chatbot: string };

  const relatedHrefs = ["/ai-tur-rezervasyonu", "/cok-dilli-musteri-hizmetleri", "/tur-otomasyonu"];

  return (
    <Layout>
      <SEOHead
        title={t(`${wb}.meta.title`)}
        description={t(`${wb}.meta.description`)}
        keywords={t(`${wb}.meta.keywords`)}
        canonical="/whatsapp-chatbot-seyahat-acentesi"
        schema={schema}
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-orange-50/50 to-background dark:from-orange-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-0">
            <MessageCircle className="w-3 h-3 mr-1" /> {t(`${wb}.badge`)}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            {t(`${wb}.hero.title1`)}{" "}
            <span className="text-orange-500">{t(`${wb}.hero.title2`)}</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t(`${wb}.hero.subtitle`)}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
              <Link to="/auth?mode=signup">{t(`${wb}.hero.ctaPrimary`)}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/">{t(`${wb}.hero.ctaSecondary`)}</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">{t(`${wb}.hero.note`)}</p>
        </div>
      </section>

      {/* Neden WhatsApp */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          {t(`${wb}.whySection.heading`)}
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          {t(`${wb}.whySection.paragraph`)}
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((item, i) => (
            <Card key={i} className="text-center p-6 border-border/50">
              <CardContent className="pt-0">
                <p className="text-4xl font-bold text-orange-500 mb-2">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
            {t(`${wb}.featuresSection.heading`)}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((item, i) => {
              const Icon = FEATURE_ICONS[i] || CheckCircle2;
              return (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-6">
                    <Icon className="w-8 h-8 text-orange-500 mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır */}
      <section className="py-16 container mx-auto px-4 max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          {t(`${wb}.howSection.heading`)}
        </h2>
        <p className="text-center text-muted-foreground mb-10">
          {t(`${wb}.howSection.subtitle`)}
        </p>
        <div className="space-y-4">
          {steps.map((item, i) => (
            <div key={i} className="flex gap-4 p-4 bg-card rounded-lg border border-border/50">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Karşılaştırma */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            {t(`${wb}.comparisonSection.heading`)}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-card rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-4 text-sm font-semibold">{cols.topic}</th>
                  <th className="text-center p-4 text-sm font-semibold text-muted-foreground">{cols.manual}</th>
                  <th className="text-center p-4 text-sm font-semibold text-orange-500">{cols.chatbot}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                    <td className="p-4 text-sm font-medium text-foreground">{row.topic}</td>
                    <td className="p-4 text-sm text-center text-muted-foreground">{row.manual}</td>
                    <td className="p-4 text-sm text-center text-orange-600 dark:text-orange-400 font-medium">{row.chatbot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center mt-4">
            <Link to="/karsilastir/turzz-vs-manuel-whatsapp" className="text-sm text-orange-500 hover:underline">
              {t(`${wb}.comparisonSection.detailLink`)}
            </Link>
          </p>
        </div>
      </section>

      {/* İlgili Çözümler */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
          {t(`${wb}.relatedSection.heading`)}
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {links.map((item, i) => (
            <Link key={i} to={relatedHrefs[i]} className="block p-5 bg-card border border-border/50 rounded-lg hover:border-orange-300 transition-colors">
              <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description} →</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-orange-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{t(`${wb}.cta.heading`)}</h2>
          <p className="text-orange-100 mb-8 max-w-xl mx-auto">{t(`${wb}.cta.description`)}</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">{t(`${wb}.cta.button`)}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
