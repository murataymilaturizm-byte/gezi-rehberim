import { useTranslation } from "react-i18next";
import { DollarSign, Users, TrendingUp, Target } from "lucide-react";
import { useAgencyDashboardData } from "@/hooks/useAgencyDashboardData";
import { DashboardSkeleton } from "@/components/admin/skeletons/DashboardSkeleton";
import { WelcomeHeader } from "@/components/admin/dashboard/WelcomeHeader";
import { HeroKPICard } from "@/components/admin/dashboard/HeroKPICard";
import { SalesTrendChart } from "@/components/admin/dashboard/SalesTrendChart";
import { RecentRegistrations } from "@/components/admin/dashboard/RecentRegistrations";
import { TourPerformance } from "@/components/admin/dashboard/TourPerformance";
import { QuickActions } from "@/components/admin/dashboard/QuickActions";
import { UsageStats } from "@/components/UsageStats";

interface AgencyDashboardProps {
  onTabChange?: (tab: string) => void;
  onNewTour?: () => void;
  onBulkImport?: () => void;
  onManualReg?: () => void;
  agencyId?: string | null;
}

export const AgencyDashboard = ({
  onTabChange,
  onNewTour,
  onBulkImport,
  onManualReg,
  agencyId,
}: AgencyDashboardProps) => {
  const { t } = useTranslation();
  const {
    stats, comparison, recentRegistrations, popularTours,
    revenueSpark, regSpark, weekTrend, monthTrend, todayStats, loading,
  } = useAgencyDashboardData(undefined, agencyId);

  if (loading) return <DashboardSkeleton />;

  const conversionRate =
    stats.totalRegistrations > 0
      ? (stats.confirmedRegistrations / stats.totalRegistrations) * 100
      : 0;

  const prevConversionRate =
    comparison.previousRegistrations > 0
      ? (comparison.previousConversion / comparison.previousRegistrations) * 100
      : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Welcome Header */}
      <WelcomeHeader
        agencyName=""
        todayRegistrations={todayStats.registrations}
        todayRevenue={todayStats.revenue}
        pendingCount={todayStats.pendingCount}
      />

      {/* 2. Hero KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HeroKPICard
          title={t("admin.dashboard.totalRevenue", { defaultValue: "Gelir (Onaylı)" })}
          value={stats.totalRevenue}
          suffix="₺"
          previousValue={comparison.previousRevenue}
          currentValue={stats.totalRevenue}
          comparisonLabel={t("dashboard.kpi.vsLastWeek", { defaultValue: "geçen haftaya göre" })}
          sparkline={revenueSpark}
          strokeColor="hsl(16 95% 55%)"
          gradientId="rev-grad"
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          onClick={() => onTabChange?.("analytics")}
        />
        <HeroKPICard
          title={t("admin.dashboard.totalRegistrations", { defaultValue: "Rezervasyonlar" })}
          value={stats.totalRegistrations}
          previousValue={comparison.previousRegistrations}
          currentValue={stats.totalRegistrations}
          comparisonLabel={t("dashboard.kpi.vsLastWeek", { defaultValue: "geçen haftaya göre" })}
          sparkline={regSpark}
          strokeColor="hsl(142 76% 36%)"
          gradientId="reg-grad"
          icon={<Users className="h-4 w-4 text-green-600" />}
          onClick={() => onTabChange?.("registrations")}
        />
        <HeroKPICard
          title={t("admin.dashboard.pendingRegistrations", { defaultValue: "Bekleyenler" })}
          value={stats.pendingRegistrations}
          previousValue={0}
          currentValue={stats.pendingRegistrations}
          strokeColor="hsl(38 92% 50%)"
          gradientId="pend-grad"
          icon={<TrendingUp className="h-4 w-4 text-orange-500" />}
          onClick={() => onTabChange?.("registrations")}
        />
        <HeroKPICard
          title={t("admin.dashboard.conversionRate", { defaultValue: "Dönüşüm Oranı" })}
          value={conversionRate.toFixed(1)}
          suffix="%"
          previousValue={prevConversionRate}
          currentValue={conversionRate}
          strokeColor="hsl(16 95% 55%)"
          gradientId="conv-grad"
          icon={<Target className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* 3. Main grid: Trend Chart + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesTrendChart weekData={weekTrend} monthData={monthTrend} />
        </div>
        <div>
          <QuickActions
            onNewTour={() => onNewTour?.()}
            onBulkImport={() => onBulkImport?.()}
            onManualReg={() => onManualReg?.()}
            onNavigateWhatsApp={() => onTabChange?.("whatsapp")}
          />
        </div>
      </div>

      {/* 4. Recent Registrations + Tour Performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentRegistrations
          registrations={recentRegistrations}
          onViewAll={() => onTabChange?.("registrations")}
        />
        <TourPerformance tours={popularTours} />
      </div>

      {/* 5. Usage stats */}
      <UsageStats />
    </div>
  );
};
