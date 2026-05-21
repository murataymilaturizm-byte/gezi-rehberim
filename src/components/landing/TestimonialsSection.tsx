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
      <div className="text-center mb-10">
        <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          {t("testimonials.title")}
        </h3>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {t("testimonials.subtitle")}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {testimonials.map((testimonial, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: index * 0.1, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
          <Card className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-card/50 h-full">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Quote className="w-10 h-10 text-primary/20" />
                <Badge variant="secondary" className="bg-success/10 text-success dark:text-success-foreground border-success/20">
                  {testimonial.result}
                </Badge>
              </div>

              <div className="flex gap-1">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-secondary text-secondary" />
                ))}
              </div>

              <p className="text-foreground leading-relaxed">
                "{testimonial.content}"
              </p>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center">
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

      <div className="text-center mt-10">
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <span>{t("advanced.stats")}</span>
        </div>
      </div>
    </div>
  );
};
