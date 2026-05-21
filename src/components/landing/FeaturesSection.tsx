import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, TrendingUp, Users, CheckCircle2, Bell, Shield } from "lucide-react";
import { motion } from "framer-motion";

export const FeaturesSection = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: MessageSquare,
      title: t("features.whatsapp.title"),
      description: t("features.whatsapp.description"),
      metric: t("features.whatsapp.metric")
    },
    {
      icon: TrendingUp,
      title: t("features.analytics.title"),
      description: t("features.analytics.description"),
      metric: t("features.analytics.metric")
    },
    {
      icon: Users,
      title: t("features.multi.title"),
      description: t("features.multi.description"),
      metric: t("features.multi.metric")
    },
    {
      icon: CheckCircle2,
      title: t("features.reservation.title"),
      description: t("features.reservation.description"),
      metric: t("features.reservation.metric")
    },
    {
      icon: Bell,
      title: t("features.reminders.title"),
      description: t("features.reminders.description"),
      metric: t("features.reminders.metric")
    },
    {
      icon: Shield,
      title: t("features.payment.title"),
      description: t("features.payment.description"),
      metric: t("features.payment.metric")
    }
  ];

  return (
    <div className="container mx-auto px-4">
      <div className="text-center mb-10">
        <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          {t("features.title")}
        </h3>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {t("features.subtitle")}
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-4 items-stretch">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
            whileHover={{ y: -4 }}
            className="flex items-start gap-5 p-5 rounded-xl border border-border/50 bg-card hover:shadow-lg transition-all duration-300 hover:border-primary/30 group h-full"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-ocean flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110">
              <feature.icon className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{feature.title}</h4>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{feature.description}</p>
              <Badge className="hidden sm:inline-flex mt-2 bg-primary/10 text-primary border-primary/20">
                {feature.metric}
              </Badge>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
