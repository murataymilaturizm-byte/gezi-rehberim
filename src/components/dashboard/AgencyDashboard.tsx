import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar as CalendarIcon, Users, Plane, TrendingUp, X, CheckCircle, MapPin } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { UsageStats } from "@/components/UsageStats";
import { useAgencyDashboardData } from "@/hooks/useAgencyDashboardData";

export const AgencyDashboard = () => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { stats, recentRegistrations, popularTours, chartData, loading } = useAgencyDashboardData(dateRange);

  const statusLabels: Record<string, string> = {
    NEW: t("admin.status.new"),
    PENDING: t("admin.status.pending"),
    CONFIRMED: t("admin.status.confirmed"),
    CANCELLED: t("admin.status.cancelled"),
  };

  const clearDateRange = () => setDateRange(undefined);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">{t("admin.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.totalRevenue")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.totalRevenue || 0).toLocaleString("tr-TR")}₺</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.confirmedReservations")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.avgBasket")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.avgBasket || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}₺</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.avgPerBooking")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.conversionRate")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              %{stats.totalRegistrations > 0 ? ((stats.confirmedRegistrations || 0) / stats.totalRegistrations * 100).toFixed(1) : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.confirmedRegistrations || 0} / {stats.totalRegistrations} {t("admin.dashboard.registrations")}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.totalTours")}</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTours}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.activeTourCount")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.totalRegistrations")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRegistrations}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.allRegistrations")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.activeDates")}</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeDates}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.tourDates")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.pendingRegistrations")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRegistrations}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.awaitingReview")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>
            {dateRange?.from && dateRange?.to
              ? `${format(dateRange.from, "d MMM", { locale: tr })} - ${format(dateRange.to, "d MMM", { locale: tr })} ${t("admin.dashboard.registrationsTitle")}`
              : t("admin.dashboard.last7Days")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="registrations" fill="hsl(var(--primary))" name={t("admin.dashboard.chartRegistrations")} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Popular & Recent Side by Side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />{t("admin.dashboard.popularDestinations")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {popularTours.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">{t("admin.dashboard.noData")}</div>
              ) : (
                popularTours.map((tour) => (
                  <div key={tour.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{tour.title}</p>
                      <p className="text-sm text-muted-foreground">{tour.destination}</p>
                    </div>
                    <Badge variant="secondary">{tour.registrationCount} {t("admin.dashboard.registration")}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />{t("admin.dashboard.recentRegistrations")}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-8 text-xs", !dateRange && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "dd/MM", { locale: tr })} - {format(dateRange.to, "dd/MM", { locale: tr })}</>
                        ) : format(dateRange.from, "dd/MM/yy", { locale: tr })
                      ) : (
                        <span>{t("admin.dashboard.filter")}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50 bg-popover" align="end">
                    <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                {dateRange && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={clearDateRange}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRegistrations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">{t("admin.registrations.noRegistrations")}</div>
              ) : (
                recentRegistrations.map((reg) => (
                  <div key={reg.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{reg.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{reg.tours?.title}</p>
                    </div>
                    <Badge
                      className="ml-2 shrink-0"
                      variant={reg.status === "CONFIRMED" ? "default" : reg.status === "CANCELLED" ? "destructive" : "secondary"}
                    >
                      {statusLabels[reg.status] || reg.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <UsageStats />
    </div>
  );
};
