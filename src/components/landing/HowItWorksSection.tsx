import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MessageSquare, Brain, CheckCircle2 } from "lucide-react";

interface HowItWorksSectionProps {
  onDemoClick: () => void;
}

export const HowItWorksSection = ({ onDemoClick }: HowItWorksSectionProps) => {
  const { t } = useTranslation();

  const steps = [
    { icon: MessageSquare, step: 1, title: t("howItWorks.step1.title"), desc: t("howItWorks.step1.description") },
    { icon: Brain, step: 2, title: t("howItWorks.step2.title"), desc: t("howItWorks.step2.description") },
    { icon: CheckCircle2, step: 3, title: t("howItWorks.step3.title"), desc: t("howItWorks.step3.description") },
  ];

  return (
    <div className="container mx-auto px-4">
      <div className="text-center mb-12">
        <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          {t("howItWorks.title")}
        </h3>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {t("howItWorks.subtitle")}
        </p>
      </div>

      <div className="max-w-3xl mx-auto relative">
        {/* Vertical line */}
        <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-border hidden md:block" />

        {steps.map((item, index) => (
          <div key={index} className={`flex items-start gap-4 mb-8 last:mb-0 md:w-1/2 ${index % 2 === 0 ? 'md:pe-10 md:ms-0' : 'md:ps-10 md:ms-auto'}`}>
            <div className="md:hidden w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0 shadow-md">
              {item.step}
            </div>
            <div className={`hidden md:flex absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-ocean items-center justify-center text-primary-foreground font-bold shadow-md`} style={{ top: `${index * 96 + 8}px` }}>
              {item.step}
            </div>
            <div className="space-y-1.5">
              <h4 className="text-lg font-bold text-foreground">{item.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Button size="lg" className="bg-gradient-ocean hover:opacity-90" onClick={onDemoClick}>
          {t("howItWorks.demoButton")}
        </Button>
      </div>
    </div>
  );
};
