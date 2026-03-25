import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  BookOpen, 
  MessageSquare, 
  Settings, 
  Upload, 
  BarChart3, 
  CreditCard,
  Shield,
  Video,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { getHelpContent } from "@/data/helpContent";

const Help = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const sectionIcons = [Settings, Upload, MessageSquare, BarChart3, CreditCard, Shield];
  const sectionColors = [
    { color: "text-primary", bgColor: "bg-primary/10" },
    { color: "text-secondary", bgColor: "bg-secondary/10" },
    { color: "text-primary", bgColor: "bg-primary/10" },
    { color: "text-secondary", bgColor: "bg-secondary/10" },
    { color: "text-primary", bgColor: "bg-primary/10" },
    { color: "text-secondary", bgColor: "bg-secondary/10" },
  ];

  const helpSections = getHelpContent(i18n.language);

  const sections = helpSections.map((section, index) => ({
    icon: sectionIcons[index] || Settings,
    title: t(`help.sections.${section.titleKey}`),
    color: sectionColors[index]?.color || "text-primary",
    bgColor: sectionColors[index]?.bgColor || "bg-primary/10",
    items: section.items,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/95 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={turzzLogo} alt="Turzz Logo" className="h-14 sm:h-16 w-auto transition-transform duration-300 hover:scale-105" />
              <div className="hidden sm:block">
                <p className="text-sm text-muted-foreground">{t("hero.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector />
              <ThemeToggle />
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/">{t("nav.home")}</a>
              </Button>
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/nasil-baslarim">{t("nav.gettingStarted")}</a>
              </Button>
              <Button asChild className="bg-gradient-ocean hover:opacity-90 transition-all duration-300 hover:scale-105">
                <a href="/auth">{t("auth.login")}</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <Badge className="mb-2">
              <BookOpen className="w-3 h-3 mr-1" />
              {t("help.title")}
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">
              {t("help.heroTitle")}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t("help.heroDescription")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {t("help.stepByStep")}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {t("help.visualGuides")}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {t("help.troubleshooting")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-12">
            {sections.map((section, sectionIndex) => (
              <Card key={sectionIndex} className="border-border/50 shadow-card overflow-hidden">
                <CardHeader className={`${section.bgColor} border-b`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg ${section.bgColor} flex items-center justify-center`}>
                      <section.icon className={`w-6 h-6 ${section.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{section.title}</CardTitle>
                      <CardDescription>
                        {t("help.topicsCount", { count: section.items.length })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Accordion type="single" collapsible className="w-full">
                    {section.items.map((item, itemIndex) => (
                      <AccordionItem key={itemIndex} value={`item-${sectionIndex}-${itemIndex}`}>
                        <AccordionTrigger className="text-left hover:text-primary">
                          <span className="font-semibold">{item.question}</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                            {item.answer}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Links */}
          <div className="max-w-5xl mx-auto mt-12">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardContent className="p-8">
                <div className="text-center space-y-4">
                  <h3 className="text-2xl font-bold text-foreground">Hala Yardıma İhtiyacınız Var mı?</h3>
                  <p className="text-muted-foreground">
                    Destek ekibimiz size yardımcı olmak için hazır
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center pt-4">
                    <Button size="lg" className="gap-2">
                      <MessageSquare className="w-5 h-5" />
                      info@ai.turzz.com
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => navigate("/nasil-baslarim")}>
                      <Video className="w-5 h-5 mr-2" />
                      Başlangıç Rehberi
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Help;
