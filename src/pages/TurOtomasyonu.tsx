import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Bell, BarChart3, Users, Calendar, MessageSquare } from "lucide-react";

const FEATURE_ICONS = [Calendar, Bell, MessageSquare, Users, BarChart3, Zap];

export default function TurOtomasyonu() {
  const { t } = useTranslation();
  const ta = "pages.tourAutomation";

  const metrics = t(`${ta}.hero.metrics`,          { returnObjects: true }) as { value: string; text: string }[];
  const features = t(`${ta}.featuresSection.items`, { returnObjects: true }) as { title: string; description: string }[];
  const rows     = t(`${ta}.timeTable.rows`,         { returnObjects: true }) as [string, string, string][];
  const totalRow = t(`${ta}.timeTable.totalRow`,     { returnObjects: true }) as [string, string, string];
  const cols     = t(`${ta}.timeTable.columns`,      { returnObjects: true }) as { task: string; manual: string; ai: string };

  return (
    <Layout>
      <SEOHead
        title={t(`${ta}.meta.title`)}
        description={t(`${ta}.meta.description`)}
        keywords={t(`${ta}.meta.keywords`)}
        canonical="/tur-otomasyonu"
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-purple-50/50 to-background dark:from-purple-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-0">
            <Zap className="w-3 h-3 mr-1" /> {t(`${ta}.badge`)}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            {t(`${ta}.hero.title1`)}{" "}
            <span className="text-purple-500">{t(`${ta}.hero.title2`)}</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t(`${ta}.hero.subtitle`)}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-purple-500 hover:bg-purple-600 text-white">
              <Link to="/auth?mode=signup">{t(`${ta}.hero.cta`)}</Link>
            </Button>
          </div>
          <div className="flex justify-center gap-8 mt-8">
            {metrics.map((item) => (
              <div key={item.text} className="text-center">
                <p className="text-2xl font-bold text-purple-500">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
          {t(`${ta}.featuresSection.heading`)}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, i) => {
            const Icon = FEATURE_ICONS[i] || Zap;
            return (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <Icon className="w-8 h-8 text-purple-500 mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Zaman Tablosu */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            {t(`${ta}.timeTable.heading`)}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-card rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-muted text-left">
                  <th className="p-3 text-sm font-semibold">{cols.task}</th>
                  <th className="p-3 text-sm font-semibold text-center">{cols.manual}</th>
                  <th className="p-3 text-sm font-semibold text-center text-purple-500">{cols.ai}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([task, manual, ai], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                    <td className="p-3 text-sm font-medium text-foreground">{task}</td>
                    <td className="p-3 text-sm text-center text-muted-foreground">{manual}</td>
                    <td className="p-3 text-sm text-center text-purple-600 dark:text-purple-400 font-medium">{ai}</td>
                  </tr>
                ))}
                <tr className="bg-purple-50 dark:bg-purple-950 font-bold">
                  <td className="p-3 text-sm text-foreground">{totalRow[0]}</td>
                  <td className="p-3 text-sm text-center text-muted-foreground">{totalRow[1]}</td>
                  <td className="p-3 text-sm text-center text-purple-600">{totalRow[2]}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-purple-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{t(`${ta}.cta.heading`)}</h2>
          <p className="text-purple-100 mb-8">{t(`${ta}.cta.description`)}</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">{t(`${ta}.cta.button`)}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
