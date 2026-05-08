import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, DollarSign, Clock, Smile, CheckCircle2 } from "lucide-react";

const WHY_ICONS = [DollarSign, Clock, Smile, Star];

export default function ButikAcenteler() {
  const { t } = useTranslation();
  const ns = "pages.cozum.boutique";

  const whyItems      = t(`${ns}.whySection.items`,         { returnObjects: true }) as { title: string; description: string }[];
  const starterFeats  = t(`${ns}.starterSection.features`,   { returnObjects: true }) as string[];

  return (
    <Layout>
      <SEOHead
        title={t(`${ns}.meta.title`)}
        description={t(`${ns}.meta.description`)}
        keywords={t(`${ns}.meta.keywords`)}
        canonical="/cozum/butik-acenteler"
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-pink-50/50 to-background dark:from-pink-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-pink-100 text-pink-700 border-0">
            <Star className="w-3 h-3 mr-1" /> {t(`${ns}.badge`)}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            {t(`${ns}.hero.title1`)}{" "}
            <span className="text-pink-500">{t(`${ns}.hero.title2`)}</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t(`${ns}.hero.subtitle`)}
          </p>
          <Button asChild size="lg" className="bg-pink-500 hover:bg-pink-600 text-white">
            <Link to="/auth?mode=signup">{t(`${ns}.hero.cta`)}</Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-2">{t(`${ns}.hero.ctaNote`)}</p>
        </div>
      </section>

      {/* Neden */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl font-bold text-center text-foreground mb-4">
          {t(`${ns}.whySection.heading`)}
        </h2>
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          {whyItems.map((item, i) => {
            const Icon = WHY_ICONS[i] || Star;
            return (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <Icon className="w-8 h-8 text-pink-500 mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Starter Paketi */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            {t(`${ns}.starterSection.heading`)}
          </h2>
          <Card className="border-pink-200 dark:border-pink-900">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{t(`${ns}.starterSection.planName`)}</h3>
                  <p className="text-muted-foreground text-sm">{t(`${ns}.starterSection.planTagline`)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-pink-500">{t(`${ns}.starterSection.price`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`${ns}.starterSection.pricePeriod`)}</p>
                </div>
              </div>
              <ul className="space-y-2">
                {starterFeats.map((item, i) => (
                  <li key={i} className="flex gap-2 items-center text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-pink-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full mt-6 bg-pink-500 hover:bg-pink-600 text-white">
                <Link to="/auth?mode=signup">{t(`${ns}.starterSection.ctaButton`)}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-pink-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">{t(`${ns}.cta.heading`)}</h2>
          <p className="text-pink-100 mb-8">{t(`${ns}.cta.description`)}</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">{t(`${ns}.cta.button`)}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
