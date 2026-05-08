import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, TrendingUp, CalendarCheck } from "lucide-react";

const FEATURE_ICONS = [Zap, Clock, CalendarCheck, TrendingUp];

export default function GunubirlikTur() {
  const { t } = useTranslation();
  const ns = "pages.cozum.daytrip";

  const features = t(`${ns}.featuresSection.items`, { returnObjects: true }) as { title: string; description: string }[];
  const messages  = t(`${ns}.scenarioSection.messages`, { returnObjects: true }) as { sender: string; text: string }[];

  return (
    <Layout>
      <SEOHead
        title={t(`${ns}.meta.title`)}
        description={t(`${ns}.meta.description`)}
        keywords={t(`${ns}.meta.keywords`)}
        canonical="/cozum/gunubirlik-tur"
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-yellow-50/50 to-background dark:from-yellow-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-yellow-100 text-yellow-700 border-0">
            <Zap className="w-3 h-3 mr-1" /> {t(`${ns}.badge`)}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            {t(`${ns}.hero.title1`)}{" "}
            <span className="text-yellow-500">{t(`${ns}.hero.title2`)}</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t(`${ns}.hero.subtitle`)}
          </p>
          <Button asChild size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-white">
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
            const Icon = FEATURE_ICONS[i] || Zap;
            return (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <Icon className="w-8 h-8 text-yellow-500 mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Senaryo */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            {t(`${ns}.scenarioSection.heading`)}
          </h2>
          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-sm text-muted-foreground mb-4">
              {t(`${ns}.scenarioSection.intro`)}
            </p>
            <div className="space-y-3">
              {messages.map((item, i) => (
                <div key={i} className={`flex ${item.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${item.sender === "user" ? "bg-yellow-500 text-white" : "bg-muted text-foreground"}`}>
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              {t(`${ns}.scenarioSection.footnote`)}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-yellow-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">{t(`${ns}.cta.heading`)}</h2>
          <p className="text-yellow-100 mb-8">{t(`${ns}.cta.description`)}</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">{t(`${ns}.cta.button`)}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
