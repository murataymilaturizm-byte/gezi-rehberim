import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";

export default function AITurRezervasyonu() {
  const { t } = useTranslation();
  const ab = "pages.aiBooking";

  const classicItems = t(`${ab}.comparisonSection.classicItems`, { returnObjects: true }) as string[];
  const aiItems      = t(`${ab}.comparisonSection.aiItems`,      { returnObjects: true }) as string[];
  const entities     = t(`${ab}.nluSection.entities`,            { returnObjects: true }) as { label: string; value: string }[];
  const languages    = t(`${ab}.langSection.languages`,          { returnObjects: true }) as { language: string; flag: string; market: string }[];

  return (
    <Layout>
      <SEOHead
        title={t(`${ab}.meta.title`)}
        description={t(`${ab}.meta.description`)}
        keywords={t(`${ab}.meta.keywords`)}
        canonical="/ai-tur-rezervasyonu"
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-blue-50/50 to-background dark:from-blue-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0">
            <Brain className="w-3 h-3 mr-1" /> {t(`${ab}.badge`)}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            {t(`${ab}.hero.title1`)}{" "}
            <span className="text-blue-500">{t(`${ab}.hero.title2`)}</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t(`${ab}.hero.subtitle`)}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-blue-500 hover:bg-blue-600 text-white">
              <Link to="/auth?mode=signup">{t(`${ab}.hero.ctaPrimary`)}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/whatsapp-chatbot-seyahat-acentesi">{t(`${ab}.hero.ctaSecondary`)}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Klasik vs AI */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          {t(`${ab}.comparisonSection.heading`)}
        </h2>
        <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
          {t(`${ab}.comparisonSection.subtitle`)}
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-red-200 dark:border-red-900">
            <CardContent className="p-6">
              <h3 className="font-bold text-foreground mb-4">{t(`${ab}.comparisonSection.classicTitle`)}</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {classicItems.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-900">
            <CardContent className="p-6">
              <h3 className="font-bold text-foreground mb-4">{t(`${ab}.comparisonSection.aiTitle`)}</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {aiItems.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* NLU Teknolojisi */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            {t(`${ab}.nluSection.heading`)}
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t(`${ab}.nluSection.subtitle`)}
          </p>
          <div className="bg-card border border-border rounded-xl p-6 mb-8">
            <p className="text-sm text-muted-foreground mb-4 font-medium">{t(`${ab}.nluSection.exampleLabel`)}</p>
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 mb-4 text-sm">
              💬 <em>{t(`${ab}.nluSection.exampleMessage`)}</em>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{t(`${ab}.nluSection.aiUnderstandsLabel`)}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {entities.map((item) => (
                <div key={item.label} className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-center text-muted-foreground text-sm">
            {t(`${ab}.nluSection.conclusion`)}
          </p>
        </div>
      </section>

      {/* 7 Dil */}
      <section className="py-16 container mx-auto px-4 max-w-4xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          {t(`${ab}.langSection.heading`)}
        </h2>
        <p className="text-center text-muted-foreground mb-10">
          {t(`${ab}.langSection.subtitle`)}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {languages.map((item) => (
            <Card key={item.language} className="text-center p-4 border-border/50">
              <CardContent className="pt-0">
                <p className="text-2xl mb-1">{item.flag}</p>
                <p className="font-semibold text-foreground text-sm">{item.language}</p>
                <p className="text-xs text-muted-foreground">{item.market}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center mt-6">
          <Link to="/cok-dilli-musteri-hizmetleri" className="text-blue-500 hover:underline text-sm">
            {t(`${ab}.langSection.linkText`)}
          </Link>
        </p>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{t(`${ab}.cta.heading`)}</h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">{t(`${ab}.cta.description`)}</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">{t(`${ab}.cta.button`)}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
