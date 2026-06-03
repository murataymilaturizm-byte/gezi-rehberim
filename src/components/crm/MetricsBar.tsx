// MetricsBar — CRM panelinin tepesinde 4 özet kart. Tamamen client-side
// hesaplama: hiçbir veri DB'den ayrı bir sorguyla gelmez, mevcut profiles
// dizisinden türetilir.
//
// Kartlar: Toplam Müşteri / VIP / Aktif (son 7 gün) / Ortalama Harcama
// Gerçek CRM'lerde (HubSpot, Pipedrive) ilk görülen şey budur — sayfa
// açılırken müdür "bugün ne durumdayım" sorusuna cevap alır.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Trophy, Zap, Wallet } from "lucide-react";
import { computeAutoTags, type ProfileForTagging } from "./customerTags";

interface MetricsBarProps {
  profiles: ProfileForTagging[];
  currencySym: string;
}

export const MetricsBar = ({ profiles, currencySym }: MetricsBarProps) => {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    let vipCount = 0;
    let activeCount = 0;
    let totalSpentSum = 0;
    let payingCount = 0;

    for (const p of profiles) {
      const auto = computeAutoTags(p);
      if (auto.includes("vip")) vipCount++;
      if (auto.includes("active")) activeCount++;
      if (p.total_spent > 0) {
        totalSpentSum += Number(p.total_spent);
        payingCount++;
      }
    }

    const avgSpending = payingCount > 0 ? Math.round(totalSpentSum / payingCount) : 0;

    return {
      total: profiles.length,
      vip: vipCount,
      active: activeCount,
      avgSpending,
    };
  }, [profiles]);

  const cards = [
    {
      icon: Users,
      label: t("admin.whatsapp.userProfiles.metrics.total"),
      value: stats.total.toLocaleString(),
      accent: "text-primary",
      bg: "bg-primary/10 dark:bg-primary/15",
      ring: "ring-primary/20",
    },
    {
      icon: Trophy,
      label: t("admin.whatsapp.userProfiles.metrics.vip"),
      value: stats.vip.toLocaleString(),
      sub: stats.total > 0 ? `${Math.round((stats.vip / stats.total) * 100)}%` : "0%",
      accent: "text-yellow-700 dark:text-yellow-400",
      bg: "bg-yellow-500/10 dark:bg-yellow-500/15",
      ring: "ring-yellow-500/20",
    },
    {
      icon: Zap,
      label: t("admin.whatsapp.userProfiles.metrics.active"),
      value: stats.active.toLocaleString(),
      sub: stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : "0%",
      accent: "text-teal-700 dark:text-teal-400",
      bg: "bg-teal-500/10 dark:bg-teal-500/15",
      ring: "ring-teal-500/20",
    },
    {
      icon: Wallet,
      label: t("admin.whatsapp.userProfiles.metrics.avgSpending"),
      value: `${stats.avgSpending.toLocaleString()} ${currencySym}`,
      sub: t("admin.whatsapp.userProfiles.metrics.avgSpendingSub", { defaultValue: "rezervasyon yapan müşteri başına" }),
      accent: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
      ring: "ring-emerald-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="border-border/60 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className={`inline-flex w-9 h-9 sm:w-10 sm:h-10 rounded-lg items-center justify-center ring-1 ${card.bg} ${card.ring}`}
                >
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.accent}`} />
                </span>
                {card.sub && (
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground tabular-nums">
                    {card.sub}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-tight">
                {card.label}
              </p>
              <p className={`text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums mt-1 ${card.accent}`}>
                {card.value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
