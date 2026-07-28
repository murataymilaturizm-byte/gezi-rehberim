import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MapPin, ArrowRight } from "lucide-react";
import type { PopularTour, PopularTourRaw } from "@/hooks/useAgencyDashboardData";

type TimeRange = "daily" | "weekly" | "monthly" | "yearly";

const RANGE_MS: Record<TimeRange, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

interface TourPerformanceProps {
  tours: PopularTour[];
  /** Madde 4: ham kayıt satırları (client-side zaman filtresi için). Yoksa fallback olarak `tours` */
  rawData?: PopularTourRaw[];
  currency?: string;
  /** Madde 4: "Detaylı rapor →" tıklanınca aktif tab'ı analytics'e çevirir */
  onNavigateAnalytics?: () => void;
}

export function TourPerformance({ tours, rawData, currency = "₺", onNavigateAnalytics }: TourPerformanceProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<TimeRange>("monthly");

  // Madde 4: rawData varsa zaman aralığına göre yeniden agrege et. Yoksa hook'tan gelen
  // hazır `tours` array'ini olduğu gibi göster (geriye uyumluluk).
  const displayed: PopularTour[] = useMemo(() => {
    if (!rawData || rawData.length === 0) return tours;
    const cutoff = Date.now() - RANGE_MS[range];
    const counts = new Map<string, PopularTour>();
    for (const r of rawData) {
      const ts = new Date(r.createdAt).getTime();
      if (Number.isFinite(ts) && ts >= cutoff) {
        const prev = counts.get(r.tourId);
        if (prev) prev.registrationCount += 1;
        else counts.set(r.tourId, { id: r.tourId, title: r.title, destination: r.destination, registrationCount: 1 });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.registrationCount - a.registrationCount).slice(0, 4); // P1-2: ilk 4 (sıralama korunur)
  }, [rawData, range, tours]);

  const maxCount = Math.max(...displayed.map((t) => t.registrationCount), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {t("dashboard.tourPerformance.title", { defaultValue: "Tur Performansı" })}
          </CardTitle>
          {onNavigateAnalytics && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-primary hover:text-primary/80"
              onClick={onNavigateAnalytics}
            >
              {t("dashboard.tourPerformance.detailedReport", { defaultValue: "Detaylı rapor" })}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
        {/* Madde 4: Zaman aralığı filtresi — Günlük / Haftalık / Aylık / Yıllık */}
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(v) => v && setRange(v as TimeRange)}
          className="mt-2 justify-start gap-1"
          size="sm"
        >
          <ToggleGroupItem value="daily" className="h-7 px-2 text-[11px]">
            {t("dashboard.tourPerformance.range.daily", { defaultValue: "Günlük" })}
          </ToggleGroupItem>
          <ToggleGroupItem value="weekly" className="h-7 px-2 text-[11px]">
            {t("dashboard.tourPerformance.range.weekly", { defaultValue: "Haftalık" })}
          </ToggleGroupItem>
          <ToggleGroupItem value="monthly" className="h-7 px-2 text-[11px]">
            {t("dashboard.tourPerformance.range.monthly", { defaultValue: "Aylık" })}
          </ToggleGroupItem>
          <ToggleGroupItem value="yearly" className="h-7 px-2 text-[11px]">
            {t("dashboard.tourPerformance.range.yearly", { defaultValue: "Yıllık" })}
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="pt-0">
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("admin.dashboard.noData", { defaultValue: "Henüz veri yok" })}
          </p>
        ) : (
          <div className="space-y-3">
            {displayed.slice(0, 4).map((tour, idx) => {
              const fillPct = Math.round((tour.registrationCount / maxCount) * 100);
              const isHot = fillPct >= 80;
              return (
                <div key={tour.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">
                        #{idx + 1}
                      </span>
                      <p className="text-sm font-medium truncate">{tour.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isHot && (
                        <Badge className="bg-orange-500 text-white text-[9px] px-1 py-0">🔥</Badge>
                      )}
                      <span className="text-xs font-semibold">{tour.registrationCount}</span>
                    </div>
                  </div>
                  <Progress value={fillPct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
