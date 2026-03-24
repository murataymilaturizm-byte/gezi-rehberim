import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar as CalendarIcon, Users, Plane, TrendingUp, X, CheckCircle, MapPin, ChevronDown, DollarSign, ShoppingCart, Clock, BarChart3 } from "lucide-react";
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
  const [showSecondary, setShowSecondary] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showPopular, setShowPopular] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  const statusLabels: Record<string, string> = {
    NEW: t("admin.status.new"),
    PENDING: t("admin.status.pending"),
    CONFIRMED: t("admin.status.confirmed"),
    CANCELLED: t("admin.status.cancelled"),
  };

  const clearDateRange = () => setDateRange(undefined);

  const conversionRate = stats.totalRegistrations > 0
    ? ((stats.confirmedRegistrations || 0) / stats.totalRegistrations * 100).toFixed(1)
    : "0";

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">{t("admin.loading")}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero Stats - Revenue & Conversion (Most Important) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="shadow-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{t("admin.dashboard.totalRevenue")}</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold tracking-tight">
              {(stats.totalRevenue || 0).toLocaleString("tr-TR")}₺
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{t("admin.dashboard.confirmedReservations")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-green-500/5 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-green-500/15 flex items-center justify-center">
                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{t("admin.dashboard.conversionRate")}</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-green-700 dark:text-green-400">
              %{conversionRate}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              {stats.confirmedRegistrations || 0}/{stats.totalRegistrations}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          {
            icon: ShoppingCart,
            label: t("admin.dashboard.avgBasket"),
            value: `${(stats.avgBasket || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}₺`,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-500/10",
          },
          {
            icon: Users,
            label: t("admin.dashboard.totalRegistrations"),
            value: stats.totalRegistrations.toString(),
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-500/10",
          },
          {
            icon: Plane,
            label: t("admin.dashboard.totalTours"),
            value: stats.totalTours.toString(),
            color: "text-orange-600 dark:text-orange-400",
            bg: "bg-orange-500/10",
          },
          {
            icon: Clock,
            label: t("admin.dashboard.pendingRegistrations"),
            value: stats.pendingRegistrations.toString(),
            color: stats.pendingRegistrations > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
            bg: stats.pendingRegistrations > 0 ? "bg-red-500/10" : "bg-muted/50",
          },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border bg-card p-2 sm:p-3 text-center shadow-sm">
            <div className={`mx-auto mb-1 h-6 w-6 sm:h-7 sm:w-7 rounded-lg ${item.bg} flex items-center justify-center`}>
              <item.icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${item.color}`} />
            </div>
            <div className={`text-sm sm:text-lg font-bold ${item.color}`}>{item.value}</div>
            <p className="text-[9px] sm:text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Expandable: Additional Details */}
      <Collapsible open={showSecondary} onOpenChange={setShowSecondary}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground h-8 text-xs">
            <span className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              {t("admin.dashboard.activeDates")}: {stats.activeDates} · {t("admin.dashboard.confirmedReservations")}: {stats.confirmedRegistrations}
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSecondary && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-card p-3 text-center">
              <CalendarIcon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{stats.activeDates}</div>
              <p className="text-[10px] text-muted-foreground">{t("admin.dashboard.tourDates")}</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <CheckCircle className="h-4 w-4 mx-auto text-green-500 mb-1" />
              <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.confirmedRegistrations}</div>
              <p className="text-[10px] text-muted-foreground">{t("admin.status.confirmed")}</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">
                {stats.totalRegistrations > 0 ? Math.round(stats.totalRevenue / stats.totalRegistrations).toLocaleString("tr-TR") : 0}₺
              </div>
              <p className="text-[10px] text-muted-foreground">{t("admin.dashboard.avgPerBooking")}</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Chart - Collapsible */}
      <Collapsible open={showChart} onOpenChange={setShowChart}>
        <Card className="shadow-card">
          <CardHeader className="p-3 sm:p-6 pb-0 sm:pb-0">
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full text-left">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "d MMM", { locale: tr })} - ${format(dateRange.to, "d MMM", { locale: tr })} ${t("admin.dashboard.registrationsTitle")}`
                    : t("admin.dashboard.last7Days")}
                </CardTitle>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0 ml-2", showChart && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-3 sm:p-6 pt-3">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))", 
                      borderRadius: "8px",
                      fontSize: "12px" 
                    }} 
                  />
                  <Bar dataKey="registrations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t("admin.dashboard.chartRegistrations")} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Popular Destinations - Collapsible */}
      <Collapsible open={showPopular} onOpenChange={setShowPopular}>
        <Card className="shadow-card">
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full text-left">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="h-4 w-4 text-primary" />{t("admin.dashboard.popularDestinations")}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{popularTours.length}</Badge>
                </CardTitle>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0 ml-2", showPopular && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="space-y-2">
                {popularTours.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6 text-sm">{t("admin.dashboard.noData")}</div>
                ) : (
                  popularTours.map((tour, index) => (
                    <div key={tour.id} className="flex items-center gap-3 p-2 sm:p-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">{tour.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{tour.destination}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs">{tour.registrationCount}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Recent Registrations - Collapsible */}
      <Collapsible open={showRecent} onOpenChange={setShowRecent}>
        <Card className="shadow-card">
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-left flex-1">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Users className="h-4 w-4 text-primary" />{t("admin.dashboard.recentRegistrations")}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{recentRegistrations.length}</Badge>
                  </CardTitle>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", showRecent && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-7 text-[11px] px-2", !dateRange && "text-muted-foreground")}>
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
                    <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                {dateRange && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearDateRange}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="space-y-2">
                {recentRegistrations.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6 text-sm">{t("admin.registrations.noRegistrations")}</div>
                ) : (
                  recentRegistrations.map((reg) => (
                    <div key={reg.id} className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                      <div className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        reg.status === "CONFIRMED" ? "bg-green-500" :
                        reg.status === "CANCELLED" ? "bg-destructive" :
                        reg.status === "PENDING" ? "bg-yellow-500" : "bg-primary"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">{reg.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{reg.tours?.title}</p>
                      </div>
                      <Badge
                        className="shrink-0 text-[10px] px-1.5 py-0"
                        variant={reg.status === "CONFIRMED" ? "default" : reg.status === "CANCELLED" ? "destructive" : "secondary"}
                      >
                        {statusLabels[reg.status] || reg.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <UsageStats />
    </div>
  );
};

      <UsageStats />
    </div>
  );
};
