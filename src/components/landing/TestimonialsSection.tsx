import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Quote, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export const TestimonialsSection = () => {
  const { t } = useTranslation();

  const testimonials = [
    {
      name: t("testimonials.items.yasinCetin.name"),
      company: t("testimonials.items.yasinCetin.company"),
      role: t("testimonials.items.yasinCetin.role"),
      content: t("testimonials.items.yasinCetin.content"),
      rating: 5,
      result: t("testimonials.items.yasinCetin.result")
    },
    {
      name: t("testimonials.items.sitkiOgrak.name"),
      company: t("testimonials.items.sitkiOgrak.company"),
      role: t("testimonials.items.sitkiOgrak.role"),
      content: t("testimonials.items.sitkiOgrak.content"),
      rating: 5,
      result: t("testimonials.items.sitkiOgrak.result")
    },
    {
      name: t("testimonials.items.mustafaGulmez.name"),
      company: t("testimonials.items.mustafaGulmez.company"),
      role: t("testimonials.items.mustafaGulmez.role"),
      content: t("testimonials.items.mustafaGulmez.content"),
      rating: 5,
      result: t("testimonials.items.mustafaGulmez.result")
    }
  ];

  return (
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="text-center mb-10"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          {t("testimonials.title")}
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {t("testimonials.subtitle")}
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {testimonials.map((testimonial, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: index * 0.1, ease: "easeOut" }}
            whileHover={{ y: -4 }}
            className="group relative"
          >
            {/* Subtle gradient glow on hover */}
            <div className="absolute -inset-px rounded-xl bg-gradient-ocean opacity-0 group-hover:opacity-50 blur-md transition-opacity duration-300 pointer-events-none" aria-hidden="true" />
            <Card className="relative border-border/50 shadow-card hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-card/60 h-full overflow-hidden">
              {/* Top accent stripe */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-ocean opacity-60" aria-hidden="true" />
              <CardContent className="p-6 space-y-4 relative">
                <div className="flex items-center justify-between">
                  <Quote className="w-10 h-10 text-primary/25 group-hover:text-primary/40 transition-colors" />
                  <Badge variant="secondary" className="bg-success/10 text-success dark:text-success-foreground border-success/20">
                    {testimonial.result}
                  </Badge>
                </div>

                <div className="flex gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-secondary text-secondary drop-shadow-sm" />
                  ))}
                </div>

                <p className="text-foreground leading-relaxed">
                  "{testimonial.content}"
                </p>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center shadow-md ring-2 ring-background">
                      <span className="text-lg font-semibold text-primary-foreground">
                        {testimonial.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="text-center mt-10"
      >
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <span>{t("advanced.stats")}</span>
        </div>
      </motion.div>
    </div>
  );
};
