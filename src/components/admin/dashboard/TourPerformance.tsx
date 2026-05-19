import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin } from "lucide-react";
import type { PopularTour } from "@/hooks/useAgencyDashboardData";

interface TourPerformanceProps {
  tours: PopularTour[];
  currency?: string;
}

export function TourPerformance({ tours, currency = "₺" }: TourPerformanceProps) {
  const { t } = useTranslation();

  const maxCount = Math.max(...tours.map((t) => t.registrationCount), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          {t("dashboard.tourPerformance.title", { defaultValue: "Tur Performansı" })}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {tours.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("admin.dashboard.noData", { defaultValue: "Henüz veri yok" })}
          </p>
        ) : (
          <div className="space-y-3">
            {tours.slice(0, 5).map((tour, idx) => {
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
