import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { contactFormSchema, checkRateLimit, sanitizeHtml } from "@/utils/validation";

export const FaqSection = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

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
        <div className="text-center mb-12">
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("faq.title")}
          </h3>
          <p className="text-muted-foreground text-lg">
            {t("faq.subtitle")}
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border border-border/50 rounded-lg px-6 bg-card shadow-sm"
            >
              <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="text-center mt-8">
          <p className="text-muted-foreground mb-4">
            {t("contact.question")}
          </p>
        </div>

        {/* Contact Form */}
        <Card className="mt-8 border-border/50 shadow-card max-w-2xl mx-auto">
          <CardContent className="p-8">
            <form onSubmit={async (e) => {
              e.preventDefault();

              // Rate limiting check (max 3 submissions per 10 minutes)
              if (!checkRateLimit('contact_form', 3, 10 * 60 * 1000)) {
                toast({
                  title: t("contact.rateLimitTitle"),
                  description: t("contact.rateLimitDesc"),
                  variant: "destructive"
                });
                return;
              }

              setIsSubmittingForm(true);

              try {
                const formData = new FormData(e.currentTarget);
                const data = {
                  name: formData.get('name') as string,
                  email: formData.get('email') as string,
                  message: formData.get('message') as string
                };

                // Validate form data with enhanced security
                const validatedData = contactFormSchema.parse(data);

                // Additional XSS protection - sanitize message content
                const sanitizedMessage = sanitizeHtml(validatedData.message);

                // Save to Supabase
                const { error } = await supabase
                  .from('contact_forms')
                  .insert({
                    name: validatedData.name,
                    email: validatedData.email,
                    message: sanitizedMessage,
                    status: 'new'
                  });

                if (error) throw error;

                toast({
                  title: t("contact.successTitle"),
                  description: t("contact.successMessage"),
                });

                // Reset form
                (e.target as HTMLFormElement).reset();
              } catch (error) {
                if (error instanceof Error && 'errors' in error) {
                  // Zod validation error
                  const zodError = error as any;
                  toast({
                    title: t("contact.formErrorTitle"),
                    description: zodError.errors[0]?.message || t("contact.validationError"),
                    variant: "destructive"
                  });
                } else {
                  console.error('Contact form error:', error);
                  toast({
                    title: t("contact.errorTitle"),
                    description: t("contact.errorMessage"),
                    variant: "destructive"
                  });
                }
              } finally {
                setIsSubmittingForm(false);
              }
            }} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">{t("contact.nameLabel")}</Label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  maxLength={100}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t("contact.namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">{t("contact.emailLabel")}</Label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={255}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t("contact.emailPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message" className="text-foreground">{t("contact.messageLabel")}</Label>
                <textarea
                  id="message"
                  name="message"
                  required
                  maxLength={1000}
                  rows={4}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder={t("contact.messagePlaceholder")}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-ocean hover:opacity-90"
                disabled={isSubmittingForm}
              >
                {isSubmittingForm ? t("contact.sending") : t("contact.sendButton")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
