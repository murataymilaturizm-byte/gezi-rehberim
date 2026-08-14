import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CheckCircle2,
  Smartphone,
  Plus,
  MessageSquare,
  Settings,
  Upload,
  Send,
  Zap
} from "lucide-react";
import turzzLogo from "@/assets/turzz-logo-orange.png";

const GettingStarted = () => {
  const { t } = useTranslation();
  const steps = [
    {
      number: 1,
      title: t("gettingStarted.steps.step1.title"),
      icon: Settings,
      duration: t("gettingStarted.steps.step1.duration"),
      description: t("gettingStarted.steps.step1.description"),
      substeps: [
        {
          title: t("gettingStarted.steps.step1.substeps.s1.title"),
          description: t("gettingStarted.steps.step1.substeps.s1.description"),
        },
        {
          title: t("gettingStarted.steps.step1.substeps.s2.title"),
          description: t("gettingStarted.steps.step1.substeps.s2.description"),
        },
        {
          title: t("gettingStarted.steps.step1.substeps.s3.title"),
          description: t("gettingStarted.steps.step1.substeps.s3.description"),
        },
      ],
      tips: [
        t("gettingStarted.steps.step1.tips.t1"),
        t("gettingStarted.steps.step1.tips.t2"),
        t("gettingStarted.steps.step1.tips.t3"),
      ],
    },
    {
      number: 2,
      title: t("gettingStarted.steps.step2.title"),
      icon: Upload,
      duration: t("gettingStarted.steps.step2.duration"),
      description: t("gettingStarted.steps.step2.description"),
      substeps: [
        {
          title: t("gettingStarted.steps.step2.substeps.s1.title"),
          description: t("gettingStarted.steps.step2.substeps.s1.description"),
        },
        {
          title: t("gettingStarted.steps.step2.substeps.s2.title"),
          description: t("gettingStarted.steps.step2.substeps.s2.description"),
        },
        {
          title: t("gettingStarted.steps.step2.substeps.s3.title"),
          description: t("gettingStarted.steps.step2.substeps.s3.description"),
        },
      ],
      tips: [
        t("gettingStarted.steps.step2.tips.t1"),
        t("gettingStarted.steps.step2.tips.t2"),
        t("gettingStarted.steps.step2.tips.t3"),
      ],
    },
    {
      number: 3,
      title: t("gettingStarted.steps.step3.title"),
      icon: Smartphone,
      duration: t("gettingStarted.steps.step3.duration"),
      description: t("gettingStarted.steps.step3.description"),
      substeps: [
        {
          title: t("gettingStarted.steps.step3.substeps.s1.title"),
          description: t("gettingStarted.steps.step3.substeps.s1.description"),
        },
        {
          title: t("gettingStarted.steps.step3.substeps.s2.title"),
          description: t("gettingStarted.steps.step3.substeps.s2.description"),
        },
        {
          title: t("gettingStarted.steps.step3.substeps.s3.title"),
          description: t("gettingStarted.steps.step3.substeps.s3.description"),
        },
      ],
      tips: [
        t("gettingStarted.steps.step3.tips.t1"),
        t("gettingStarted.steps.step3.tips.t2"),
        t("gettingStarted.steps.step3.tips.t3"),
      ],
    },
    {
      number: 4,
      title: t("gettingStarted.steps.step4.title"),
      icon: Send,
      duration: t("gettingStarted.steps.step4.duration"),
      description: t("gettingStarted.steps.step4.description"),
      substeps: [
        {
          title: t("gettingStarted.steps.step4.substeps.s1.title"),
          description: t("gettingStarted.steps.step4.substeps.s1.description"),
        },
        {
          title: t("gettingStarted.steps.step4.substeps.s2.title"),
          description: t("gettingStarted.steps.step4.substeps.s2.description"),
        },
        {
          title: t("gettingStarted.steps.step4.substeps.s3.title"),
          description: t("gettingStarted.steps.step4.substeps.s3.description"),
        },
      ],
      tips: [
        t("gettingStarted.steps.step4.tips.t1"),
        t("gettingStarted.steps.step4.tips.t2"),
        t("gettingStarted.steps.step4.tips.t3"),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24 bg-gradient-to-b from-accent/20 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <Badge className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-primary/20">
              <Zap className="w-4 h-4 mr-2" />
              {t("gettingStarted.title")}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
              {t("gettingStarted.subtitle")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("gettingStarted.heroDescription")}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>{t("gettingStarted.badge1")}</span>
              <span className="mx-2">•</span>
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>{t("gettingStarted.badge2")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Steps */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-16">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative">
                  {/* Connecting Line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-8 top-24 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-transparent hidden md:block" />
                  )}

                  <Card className="relative border-2 border-border/50 shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="p-8 md:p-10">
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Step Number & Icon */}
                        <div className="flex flex-col items-center md:items-start gap-4 flex-shrink-0">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-gradient-ocean flex items-center justify-center shadow-lg">
                              <span className="text-2xl font-bold text-white">{step.number}</span>
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                              <Icon className="w-5 h-5 text-secondary-foreground" />
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {step.duration} {t("gettingStarted.duration")}
                          </Badge>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-6">
                          <div>
                            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                              {step.title}
                            </h3>
                            <p className="text-muted-foreground text-lg">
                              {step.description}
                            </p>
                          </div>

                          {/* Sub-steps */}
                          <div className="space-y-4">
                            {step.substeps.map((substep, subIndex) => (
                              <div key={subIndex} className="flex gap-4 items-start">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                                  <span className="text-xs font-semibold text-primary">
                                    {subIndex + 1}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-foreground mb-1">
                                    {substep.title}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {substep.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Tips */}
                          <div className="bg-accent/20 rounded-lg p-5 border border-accent/30">
                            <div className="flex items-center gap-2 mb-3">
                              <Settings className="w-5 h-5 text-primary" />
                              <span className="font-semibold text-foreground">{t("gettingStarted.tips")}</span>
                            </div>
                            <ul className="space-y-2">
                              {step.tips.map((tip, tipIndex) => (
                                <li key={tipIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-background to-accent/10">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto border-2 border-primary/20 shadow-2xl">
            <CardContent className="p-8 md:p-12 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-ocean mb-4">
                <MessageSquare className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                {t("gettingStarted.ready")}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("gettingStarted.readyDescription")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button
                  size="lg"
                  className="bg-gradient-ocean hover:opacity-90 text-lg px-8"
                  asChild
                >
                  <a href="/auth?mode=signup">
                    {t("auth.startFreeTrial")}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8"
                  asChild
                >
                  <a href="/">
                    {t("gettingStarted.backHome")}
                  </a>
                </Button>
              </div>
              <div className="flex items-center justify-center gap-6 pt-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>14 gün ücretsiz</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Kredi kartı gerekmez</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>İstediğiniz zaman iptal</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <a href="/"><img src={turzzLogo} alt="Turzz Logo" className="h-12 w-auto cursor-pointer" /></a>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Turzz. {t("gettingStarted.footerRights")}
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                {t("gettingStarted.footerHome")}
              </a>
              <a href="/auth" className="text-muted-foreground hover:text-foreground transition-colors">
                {t("gettingStarted.footerLogin")}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GettingStarted;
