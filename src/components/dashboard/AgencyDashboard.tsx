import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DollarSign, Users, TrendingUp, Target, Sun, AlertCircle, RefreshCw } from "lucide-react";
import { useAgencyDashboardData } from "@/hooks/useAgencyDashboardData";
import { DashboardSkeleton } from "@/components/admin/skeletons/DashboardSkeleton";
import { WelcomeHeader } from "@/components/admin/dashboard/WelcomeHeader";
import { HeroKPICard } from "@/components/admin/dashboard/HeroKPICard";
import { SalesTrendChart } from "@/components/admin/dashboard/SalesTrendChart";
import { RecentRegistrations } from "@/components/admin/dashboard/RecentRegistrations";
import { TourPerformance } from "@/components/admin/dashboard/TourPerformance";
import { QuickActions } from "@/components/admin/dashboard/QuickActions";
import { UsageStats } from "@/components/UsageStats";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
// Madde 5: Dashboard'dan da rezervasyon detayı (ödeme + WhatsApp + güncelleme)
import { RegistrationDetailDialog } from "@/components/admin/RegistrationDetailDialog";

interface AgencyDashboardProps {
  onTabChange?: (tab: string) => void;
  onNewTour?: () => void;
  onBulkImport?: () => void;
  onManualReg?: () => void;
  agencyId?: string | null;
  agencyName?: string;
  whatsappStatus?: string;
}

export const AgencyDashboard = ({
  onTabChange,
  onNewTour,
  onBulkImport,
  onManualReg,
  agencyId,
  agencyName = "",
  whatsappStatus,
}: AgencyDashboardProps) => {
  const { t } = useTranslation();
  const {
    stats, comparison, recentRegistrations, popularTours, popularToursRaw,
    revenueSpark, regSpark, weekTrend, monthTrend, todayStats, loading,
    error, reload,   // O2: hata banner'ı + reload butonu
  } = useAgencyDashboardData(undefined, agencyId);

  // Madde 5: Rezervasyon detay dialog'u — Rezervasyonlar sayfasıyla AYNI bileşen.
  // Ödeme ekleme + WhatsApp butonu + durum güncelleme buradan da çalışır.
  const [detailReg, setDetailReg] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
      {/* O2: Veri yükleme hatası — sessiz boş veri yerine görünür uyarı + tekrar dene */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {t("dashboard.error.title", { defaultValue: "Veriler yüklenemedi" })}
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm">
              {t("dashboard.error.description", {
                defaultValue: "Sunucuya bağlanırken bir hata oluştu. Bağlantınızı kontrol edip tekrar deneyin.",
              })}
            </span>
            <Button variant="outline" size="sm" onClick={() => reload?.()} className="shrink-0">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t("common.retry", { defaultValue: "Tekrar dene" })}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 1. Welcome Header — AIMascot + bot status + greeting (sol taraf) */}
      <WelcomeHeader
        agencyName={agencyName}
        todayRegistrations={todayStats.registrations}
        todayRevenue={todayStats.revenue}
        pendingCount={todayStats.pendingCount}
        whatsappStatus={whatsappStatus}
      />

      {/* 2. Hero KPI Cards — 5 kart (Bugün + Tahsilat + Hacim ayrı) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <HeroKPICard
          title={t("admin.dashboard.todaySales", { defaultValue: "Bugün" })}
          value={todayStats.registrations}
          previousValue={0}
          currentValue={todayStats.registrations}
          comparisonLabel={
            todayStats.revenue > 0
              ? `${t("dashboard.kpi.paidShort", { defaultValue: "Tahsilat" })}: ${todayStats.revenue.toLocaleString("tr-TR")}₺`
              : t("dashboard.kpi.noTodaySales", { defaultValue: "henüz tahsilat yok" })
          }
          // K1: Bugün rezerve edilen hacim — tahsilattan farklı olabilir
          secondaryLabel={
            todayStats.bookingVolume > 0
              ? `${t("dashboard.kpi.reservedShort", { defaultValue: "Rezerve" })}: ${todayStats.bookingVolume.toLocaleString("tr-TR")}₺`
              : undefined
          }
          strokeColor="hsl(38 92% 50%)"
          gradientId="today-grad"
          icon={<Sun className="h-4 w-4 text-amber-500" />}
          onClick={() => onTabChange?.("registrations")}
        />
        <HeroKPICard
          // K1: "Gelir (Onaylı)" → "Tahsilat" (gerçek paid_amount toplamı)
          title={t("admin.dashboard.collectedRevenue", { defaultValue: "Tahsilat" })}
          value={stats.totalRevenue}
          suffix="₺"
          previousValue={comparison.previousRevenue}
          currentValue={stats.totalRevenue}
          comparisonLabel={t("dashboard.kpi.vsLastWeek", { defaultValue: "geçen haftaya göre" })}
          // K1: ikincil olarak rezervasyon hacmi (henüz tahsil edilmemiş ciro)
          secondaryLabel={
            stats.bookingVolume > 0
              ? `${t("dashboard.kpi.reservedShort", { defaultValue: "Rezerve" })}: ${Math.round(stats.bookingVolume).toLocaleString("tr-TR")}₺`
              : undefined
          }
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
          // Madde 5: satıra tıklanınca aynı dialog (ödeme + WhatsApp + güncelleme) açılır
          onRowClick={(reg) => {
            setDetailReg(reg);
            setDetailOpen(true);
          }}
        />
        <TourPerformance
          tours={popularTours}
          rawData={popularToursRaw}
          onNavigateAnalytics={() => onTabChange?.("analytics")}
        />
      </div>

      {/* 5. Usage stats */}
      <UsageStats />

      {/* Madde 5: Rezervasyon detay dialog'u — Rezervasyonlar sayfasıyla AYNI bileşen.
          Dashboard'dan tıklanan satır burada açılır. onSuccess'te data reload. */}
      <RegistrationDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        registration={detailReg}
        onSuccess={() => reload?.()}
      />
    </div>
  );
};
