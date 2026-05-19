import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, ArrowRight, Banknote } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { RecentRegistration } from "@/hooks/useAgencyDashboardData";

interface RecentRegistrationsProps {
  registrations: RecentRegistration[];
  onViewAll: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-green-500 text-white",
  NEW: "bg-blue-500 text-white",
  PENDING: "bg-yellow-500 text-white",
  CANCELLED: "bg-red-500 text-white",
};

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "şimdi";
  if (mins < 60) return `${mins}dk`;
  if (mins < 1440) return `${Math.floor(mins / 60)}s`;
  return `${Math.floor(mins / 1440)}g`;
}

export function RecentRegistrations({ registrations, onViewAll }: RecentRegistrationsProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t("dashboard.recentRegistrations.title", { defaultValue: "Son Rezervasyonlar" })}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onViewAll}>
            {t("common.viewAll", { defaultValue: "Tümü" })}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {registrations.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("dashboard.recentRegistrations.emptyTitle", { defaultValue: "Henüz rezervasyon yok" })}
            description={t("dashboard.recentRegistrations.emptyDescription", { defaultValue: "WhatsApp botunuz müşterileri karşılıyor" })}
          />
        ) : (
          <div className="space-y-1.5">
            {registrations.slice(0, 8).map((reg) => {
              const initials = reg.full_name?.charAt(0).toUpperCase() || "?";
              const statusStyle = STATUS_STYLE[reg.status] || STATUS_STYLE.NEW;
              return (
                <div
                  key={reg.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{reg.full_name}</p>
                      <Badge className={`text-[10px] px-1.5 py-0 ${statusStyle} shrink-0`}>
                        {t(`admin.status.${reg.status?.toLowerCase()}`, { defaultValue: reg.status })}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {reg.tours?.title && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                          <Calendar className="h-2.5 w-2.5 shrink-0" />
                          {reg.tours.title}
                        </span>
                      )}
                      {reg.tour_dates?.departure_date && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(reg.tour_dates.departure_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {reg.tour_dates?.price_adult ? (
                      <p className="text-sm font-semibold">
                        {(reg.tour_dates.price_adult * reg.pax).toLocaleString("tr-TR")}₺
                      </p>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{timeAgo(reg.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
