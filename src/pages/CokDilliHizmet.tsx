import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, TrendingUp, Users, CheckCircle2 } from "lucide-react";

const STAT_ICONS = [TrendingUp, Users, Globe];

export default function CokDilliHizmet() {
  const { t } = useTranslation();
  const ml = "pages.multilingual";

  const languages = t(`${ml}.langSection.languages`, { returnObjects: true }) as {
    flag: string; code: string; name: string; description: string;
  }[];
  const stats    = t(`${ml}.statsSection.stats`,     { returnObjects: true }) as { value: string; text: string }[];
  const benefits = t(`${ml}.benefitsSection.items`,  { returnObjects: true }) as string[];

  return (
    <Layout>
      <SEOHead
        title={t(`${ml}.meta.title`)}
        description={t(`${ml}.meta.description`)}
        keywords={t(`${ml}.meta.keywords`)}
        canonical="/cok-dilli-musteri-hizmetleri"
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-green-50/50 to-background dark:from-green-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0">
            <Globe className="w-3 h-3 mr-1" /> {t(`${ml}.badge`)}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            <span className="text-green-500">{t(`${ml}.hero.title1`)}</span>{" "}
            {t(`${ml}.hero.title2`)}
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t(`${ml}.hero.subtitle`)}
          </p>
          <Button asChild size="lg" className="bg-green-500 hover:bg-green-600 text-white">
            <Link to="/auth?mode=signup">{t(`${ml}.hero.cta`)}</Link>
          </Button>
        </div>
      </section>

      {/* 7 Dil */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          {t(`${ml}.langSection.heading`)}
        </h2>
        <p className="text-center text-muted-foreground mb-10">
          {t(`${ml}.langSection.subtitle`)}
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {languages.map((item) => (
            <Card key={item.code} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-3xl">{item.flag}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{item.name}</span>
                    <Badge variant="outline" className="text-xs">{item.code}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* İstatistikler */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            {t(`${ml}.statsSection.heading`)}
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {stats.map((item, i) => {
              const Icon = STAT_ICONS[i] || Globe;
              return (
                <Card key={i} className="text-center p-6">
                  <CardContent className="pt-0">
                    <Icon className="w-8 h-8 text-green-500 mx-auto mb-3" />
                    <p className="text-3xl font-bold text-foreground mb-1">{item.value}</p>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Faydalar */}
      <section className="py-16 container mx-auto px-4 max-w-3xl">
        <h2 className="text-2xl font-bold text-center text-foreground mb-8">
          {t(`${ml}.benefitsSection.heading`)}
        </h2>
        <ul className="space-y-4">
          {benefits.map((item, i) => (
            <li key={i} className="flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 p-5 bg-green-50 dark:bg-green-950 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>{t(`${ml}.benefitsSection.tipLabel`)}</strong>{" "}
            {t(`${ml}.benefitsSection.tipText`)}{" "}
            <Link to="/#pricing" className="text-green-600 hover:underline">
              {t(`${ml}.benefitsSection.tipLink`)}
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-green-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{t(`${ml}.cta.heading`)}</h2>
          <p className="text-green-100 mb-8">{t(`${ml}.cta.description`)}</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">{t(`${ml}.cta.button`)}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
