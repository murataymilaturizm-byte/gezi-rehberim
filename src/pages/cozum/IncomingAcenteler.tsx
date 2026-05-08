import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Clock, MessageCircle, Star } from "lucide-react";

const FEATURE_ICONS = [Globe, Clock, MessageCircle, Star];

export default function IncomingAcenteler() {
  const { t } = useTranslation();
  const ns = "pages.cozum.incoming";

  const features   = t(`${ns}.featuresSection.items`, { returnObjects: true }) as { title: string; description: string }[];
  const scenarios  = t(`${ns}.scenariosSection.scenarios`, { returnObjects: true }) as { who: string; message: string; response: string }[];

  return (
    <Layout>
      <SEOHead
        title={t(`${ns}.meta.title`)}
        description={t(`${ns}.meta.description`)}
        keywords={t(`${ns}.meta.keywords`)}
        canonical="/cozum/incoming-acenteler"
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-teal-50/50 to-background dark:from-teal-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-teal-100 text-teal-700 border-0">
            <Globe className="w-3 h-3 mr-1" /> {t(`${ns}.badge`)}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            {t(`${ns}.hero.title1`)}{" "}
            <span className="text-teal-500">{t(`${ns}.hero.title2`)}</span>{" "}
            {t(`${ns}.hero.title3`)}
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t(`${ns}.hero.subtitle`)}
          </p>
          <Button asChild size="lg" className="bg-teal-500 hover:bg-teal-600 text-white">
            <Link to="/auth?mode=signup">{t(`${ns}.hero.cta`)}</Link>
          </Button>
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">
          {t(`${ns}.featuresSection.heading`)}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((item, i) => {
            const Icon = FEATURE_ICONS[i] || Globe;
            return (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <Icon className="w-8 h-8 text-teal-500 mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Senaryolar */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            {t(`${ns}.scenariosSection.heading`)}
          </h2>
          <div className="space-y-4">
            {scenarios.map((item, i) => (
              <div key={i} className="bg-card rounded-lg border border-border/50 p-4">
                <p className="text-sm font-medium text-foreground mb-2">{item.who}</p>
                <p className="text-sm text-muted-foreground italic mb-2">{item.message}</p>
                <div className="flex gap-2 items-start">
                  <span className="text-teal-500 text-xs font-medium mt-0.5">
                    {t(`${ns}.scenariosSection.turzAiLabel`)}
                  </span>
                  <p className="text-xs text-muted-foreground">{item.response}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-teal-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">{t(`${ns}.cta.heading`)}</h2>
          <p className="text-teal-100 mb-8">{t(`${ns}.cta.description`)}</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">{t(`${ns}.cta.button`)}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
