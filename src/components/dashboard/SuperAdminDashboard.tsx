import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Users, TrendingUp, Building2, MessageSquare, CheckCircle, XCircle, Filter, MapPin } from "lucide-react";
import { useSuperAdminDashboardData } from "@/hooks/useSuperAdminDashboardData";
import { RevenueAnalytics } from "@/components/RevenueAnalytics";
import { PlanFeatures } from "@/utils/planFeatures";

interface SuperAdminDashboardProps {
  planFeatures?: PlanFeatures | null;
}

export const SuperAdminDashboard = ({ planFeatures }: SuperAdminDashboardProps) => {
  const { t } = useTranslation();
  const {
    superAdminStats, revenueChartData, loading,
    chartMonths, setChartMonths,
    selectedPlans, handlePlanToggle,
    showComparison, setShowComparison,
  } = useSuperAdminDashboardData();

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">{t("admin.loading")}</div>;
  }

  if (!superAdminStats) return null;

  const planPrices = { starter: 2999, professional: 4999, enterprise: 7999 };
  const monthlyRevenue =
    superAdminStats.agenciesByPlan.starter * planPrices.starter +
    superAdminStats.agenciesByPlan.professional * planPrices.professional +
    superAdminStats.agenciesByPlan.enterprise * planPrices.enterprise;
  const yearlyRevenue = monthlyRevenue * 12;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.totalAgencies")}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superAdminStats.totalAgencies}</div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                {superAdminStats.activeAgencies} {t("admin.dashboard.active")}
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-500" />
                {superAdminStats.inactiveAgencies} {t("admin.dashboard.inactive")}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.trialVersion")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superAdminStats.trialAgencies}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.agenciesInTrial")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.totalMessages")}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superAdminStats.totalMessagesUsed.toLocaleString("tr-TR")}</div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.messagesUsedThisMonth")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.activeRate")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              %{superAdminStats.totalAgencies > 0
                ? Math.round((superAdminStats.activeAgencies / superAdminStats.totalAgencies) * 100)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.dashboard.activeAgencyRate")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["starter", "professional", "enterprise"] as const).map((plan) => {
          const colors = { starter: "text-blue-500", professional: "text-purple-500", enterprise: "text-amber-500" };
          const labels = { starter: "starterPlan", professional: "professionalPlan", enterprise: "enterprisePlan" };
          return (
            <Card key={plan} className="shadow-card">
              <CardHeader><CardTitle className="text-base">{t(`admin.dashboard.${labels[plan]}`)}</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${colors[plan]}`}>{superAdminStats.agenciesByPlan[plan]}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {superAdminStats.agenciesByPlan[plan]} × {planPrices[plan].toLocaleString("tr-TR")}₺ = {(superAdminStats.agenciesByPlan[plan] * planPrices[plan]).toLocaleString("tr-TR")}₺/{t("admin.dashboard.month")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <TrendingUp className="w-5 h-5" />{t("admin.dashboard.monthlyRevenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600 dark:text-green-400">{monthlyRevenue.toLocaleString("tr-TR")}₺</div>
            <p className="text-sm text-muted-foreground mt-2">{t("admin.dashboard.activeSubscriptionsOnly")}</p>
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("admin.dashboard.trialAgenciesLabel")}</span>
                <Badge variant="secondary">{superAdminStats.trialAgencies} {t("admin.dashboard.agency")}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />{t("admin.dashboard.yearlyRevenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{yearlyRevenue.toLocaleString("tr-TR")}₺</div>
            <p className="text-sm text-muted-foreground mt-2">{t("admin.dashboard.yearlyValueText")}</p>
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("admin.dashboard.avgAgencyValue")}</span>
                <span className="font-medium">
                  {((superAdminStats.agenciesByPlan.starter + superAdminStats.agenciesByPlan.professional + superAdminStats.agenciesByPlan.enterprise) > 0
                    ? Math.round(monthlyRevenue / (superAdminStats.agenciesByPlan.starter + superAdminStats.agenciesByPlan.professional + superAdminStats.agenciesByPlan.enterprise))
                    : 0).toLocaleString("tr-TR")}₺/ay
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real Revenue Analytics */}
      {planFeatures?.has_analytics && <RevenueAnalytics />}

      {/* Revenue Trend Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>{t("admin.dashboard.revenueGrowthTrend")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t("admin.dashboard.realPaymentDataAnalysis")}</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />{t("admin.dashboard.filters")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">{t("admin.dashboard.dateRange")}</h4>
                    <Select value={chartMonths.toString()} onValueChange={(v) => setChartMonths(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">{t("admin.dashboard.last3Months")}</SelectItem>
                        <SelectItem value="6">{t("admin.dashboard.last6Months")}</SelectItem>
                        <SelectItem value="12">{t("admin.dashboard.last12Months")}</SelectItem>
                        <SelectItem value="24">{t("admin.dashboard.last24Months")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">{t("admin.dashboard.planTypes")}</h4>
                    <div className="space-y-2">
                      {(["starter", "professional", "enterprise"] as const).map((plan) => (
                        <div key={plan} className="flex items-center space-x-2">
                          <Checkbox id={plan} checked={selectedPlans.includes(plan)} onCheckedChange={() => handlePlanToggle(plan)} />
                          <label htmlFor={plan} className="text-sm cursor-pointer">{t(`admin.dashboard.${plan}PlanPrice`)}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="comparison" checked={showComparison} onCheckedChange={(c) => setShowComparison(!!c)} />
                    <label htmlFor="comparison" className="text-sm cursor-pointer">{t("admin.dashboard.compareWithPrevious")}</label>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" style={{ fontSize: "12px" }} />
              <YAxis yAxisId="left" style={{ fontSize: "12px" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K₺`} />
              <YAxis yAxisId="right" orientation="right" style={{ fontSize: "12px" }} />
              <Tooltip
                formatter={(value: any, name: string) => {
                  if (name === t("admin.dashboard.revenue")) return [`${Number(value).toLocaleString("tr-TR")}₺`, name];
                  return [value, name];
                }}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name={t("admin.dashboard.revenue")} dot={{ fill: "hsl(var(--primary))" }} />
              <Line yAxisId="right" type="monotone" dataKey="newAgencies" stroke="hsl(142, 76%, 36%)" strokeWidth={2} name={t("admin.dashboard.newAgencies")} dot={{ fill: "hsl(142, 76%, 36%)" }} />
            </LineChart>
          </ResponsiveContainer>
          {selectedPlans.length > 0 && selectedPlans.length < 3 && (
            <div className="mt-4 p-3 bg-accent/30 border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>{t("admin.dashboard.activeFilter")}</strong> {t("admin.dashboard.only")} {selectedPlans.map((p) => t(`admin.dashboard.${p}`)).join(", ")} {t("admin.dashboard.plansShowing")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Geographic Distribution */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>{t("admin.dashboard.geographicDistributionTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t("admin.dashboard.geographicDistributionDesc")}</p>
        </CardHeader>
        <CardContent>
          {superAdminStats.geographicData.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={superAdminStats.geographicData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="location" className="text-xs" angle={-45} textAnchor="end" height={120} />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name={t("admin.dashboard.agencyCount")} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-border">
                {superAdminStats.geographicData.slice(0, 5).map((item, index) => (
                  <div key={item.location} className="text-center">
                    <div className="text-2xl font-bold text-primary">#{index + 1}</div>
                    <div className="text-sm font-medium">{item.location}</div>
                    <div className="text-xs text-muted-foreground">{item.count} {t("admin.dashboard.agencies")}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">{t("admin.dashboard.noLocationInfo")}</h4>
              <p className="text-sm text-muted-foreground max-w-md">{t("admin.dashboard.noLocationInfoDesc")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="shadow-card bg-accent/30 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{t("admin.superAdmin")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("admin.dashboard.superAdminDescription")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
