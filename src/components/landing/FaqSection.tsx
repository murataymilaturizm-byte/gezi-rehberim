import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";

export const FaqSection = () => {
  const { t } = useTranslation();

  const faqs = [
    {
      question: t("faq.items.salesIncrease.question"),
      answer: t("faq.items.salesIncrease.answer")
    },
    {
      question: t("faq.items.setup.question"),
      answer: t("faq.items.setup.answer")
    },
    {
      // Müşteri talebi: "Turlarımı nasıl eklerim?" — onboarding sürtünmesini önle.
      // Cevap: manuel + Excel toplu seçeneklerini birlikte belirt.
      question: t("faq.items.addingTours.question"),
      answer: t("faq.items.addingTours.answer")
    },
    {
      question: t("faq.items.whatsappCost.question"),
      answer: t("faq.items.whatsappCost.answer")
    },
    {
      question: t("faq.items.payment.question"),
      answer: t("faq.items.payment.answer")
    },
    {
      question: t("faq.items.tourLimit.question"),
      answer: t("faq.items.tourLimit.answer")
    },
    {
      question: t("faq.items.cancellation.question"),
      answer: t("faq.items.cancellation.answer")
    }
  ];

  return (
    <div className="container mx-auto px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-ocean shadow-md mb-4">
            <HelpCircle className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("faq.title")}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("faq.subtitle")}
          </p>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
            >
              <AccordionItem
                value={`item-${index}`}
                className="border border-border/50 rounded-xl px-6 bg-card shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200 data-[state=open]:border-primary/50 data-[state=open]:shadow-md"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-4 [&[data-state=open]]:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </div>
  );
};
