// ContactCollapsible — Pricing altı "Bize Ulaşın" collapsible iletişim formu.
// Önceden FaqSection altındaydı; sadeleştirme turunda Pricing altına taşındı.
// Kapalıyken tek satır (ok+başlık), tıklayınca form açılır. Form işlevi tamamen
// FaqSection'daki orijinaliyle aynı: zod validation + sanitizeHtml + contact_forms
// insert + toast (success/error/rate-limit).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronDown, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackLead } from "@/components/MetaPixel";
import { contactFormSchema, checkRateLimit, sanitizeHtml } from "@/utils/validation";

export const ContactCollapsible = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!checkRateLimit("contact_form", 3, 10 * 60 * 1000)) {
      toast({
        title: t("contact.rateLimitTitle"),
        description: t("contact.rateLimitDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        name: formData.get("name") as string,
        email: formData.get("email") as string,
        message: formData.get("message") as string,
      };
      const validated = contactFormSchema.parse(data);
      const sanitizedMessage = sanitizeHtml(validated.message);

      const { error } = await supabase.from("contact_forms").insert({
        name: validated.name,
        email: validated.email,
        message: sanitizedMessage,
        status: "new",
      });
      if (error) throw error;

      // Meta Pixel Lead — yalnız marketing-onayı + Pixel yüklüyse gönderilir (consent-gated).
      trackLead({ content_name: "contact_form" });

      toast({
        title: t("contact.successTitle"),
        description: t("contact.successMessage"),
      });
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      if (error instanceof Error && "errors" in error) {
        const zodError = error as unknown as { errors: { message: string }[] };
        toast({
          title: t("contact.formErrorTitle"),
          description: zodError.errors[0]?.message || t("contact.validationError"),
          variant: "destructive",
        });
      } else {
        console.error("Contact form error:", error);
        toast({
          title: t("contact.errorTitle"),
          description: t("contact.errorMessage"),
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-10 sm:py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            aria-expanded={isOpen}
            aria-controls="contact-form-panel"
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-accent/30 transition-colors min-h-[56px]"
          >
            <span className="flex items-center gap-3">
              <span className="inline-flex w-9 h-9 rounded-lg bg-primary/10 items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </span>
              <span className="text-left">
                <span className="block font-semibold text-foreground text-sm sm:text-base">
                  {t("contact.question")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("contact.collapsibleHint", { defaultValue: "Forma 1 tıkla — birkaç saat içinde dönüş yapıyoruz" })}
                </span>
              </span>
            </span>
            <ChevronDown
              className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                id="contact-form-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden border-t border-border/60"
              >
                <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name" className="text-foreground">
                      {t("contact.nameLabel")}
                    </Label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      required
                      maxLength={100}
                      className="w-full px-4 py-2.5 min-h-[44px] border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
                      placeholder={t("contact.namePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="text-foreground">
                      {t("contact.emailLabel")}
                    </Label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      maxLength={255}
                      className="w-full px-4 py-2.5 min-h-[44px] border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
                      placeholder={t("contact.emailPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-message" className="text-foreground">
                      {t("contact.messageLabel")}
                    </Label>
                    <textarea
                      id="contact-message"
                      name="message"
                      required
                      maxLength={1000}
                      rows={4}
                      className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-shadow focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
                      placeholder={t("contact.messagePlaceholder")}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-ocean hover:opacity-90 min-h-[48px]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t("contact.sending") : t("contact.sendButton")}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
