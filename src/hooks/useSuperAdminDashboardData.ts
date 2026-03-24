import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { tr } from "date-fns/locale";

export interface SuperAdminStats {
  totalAgencies: number;
  activeAgencies: number;
  inactiveAgencies: number;
  trialAgencies: number;
  totalMessagesUsed: number;
  agenciesByPlan: { starter: number; professional: number; enterprise: number };
  geographicData: { location: string; count: number }[];
}

export interface RevenueChartData {
  month: string;
  revenue: number;
  newAgencies: number;
}

export function useSuperAdminDashboardData() {
  const { t } = useTranslation();
  const [superAdminStats, setSuperAdminStats] = useState<SuperAdminStats | null>(null);
  const [revenueChartData, setRevenueChartData] = useState<RevenueChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMonths, setChartMonths] = useState(12);
  const [selectedPlans, setSelectedPlans] = useState<string[]>(["starter", "professional", "enterprise"]);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    loadSuperAdminStats();
  }, []);

  useEffect(() => {
    if (superAdminStats) {
      loadRevenueTrendWithFilters();
    }
  }, [chartMonths, selectedPlans]);

  const loadSuperAdminStats = async () => {
    setLoading(true);
    try {
      const { data: agencies, error } = await supabase
        .from("agencies")
        .select("id, active, subscription_status, plan_type, monthly_message_count, created_at, city, region");
      if (error) throw error;

      const totalAgencies = agencies?.length || 0;
      const activeAgencies = agencies?.filter((a) => a.active).length || 0;
      const trialAgencies = agencies?.filter((a) => a.subscription_status === "trial").length || 0;
      const totalMessagesUsed = agencies?.reduce((sum, a) => sum + (a.monthly_message_count || 0), 0) || 0;
      const paidAgencies = agencies?.filter((a) => a.active && a.subscription_status === "active") || [];

      const agenciesByPlan = {
        starter: paidAgencies.filter((a) => a.plan_type === "starter").length,
        professional: paidAgencies.filter((a) => a.plan_type === "professional").length,
        enterprise: paidAgencies.filter((a) => a.plan_type === "enterprise").length,
      };

      const cityDistribution = agencies?.reduce((acc: Record<string, number>, agency: any) => {
        const location = agency.city || agency.region || t("admin.dashboard.unspecified");
        acc[location] = (acc[location] || 0) + 1;
        return acc;
      }, {}) || {};

      const geographicData = Object.entries(cityDistribution)
        .map(([location, count]) => ({ location, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const stats: SuperAdminStats = {
        totalAgencies, activeAgencies,
        inactiveAgencies: totalAgencies - activeAgencies,
        trialAgencies, totalMessagesUsed, agenciesByPlan, geographicData,
      };
      setSuperAdminStats(stats);
      await loadRevenueTrend(agencies || []);
    } catch (error) {
      console.error("Super admin stats error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRevenueTrendWithFilters = async () => {
    try {
      const { data: agencies, error } = await supabase
        .from("agencies")
        .select("id, active, subscription_status, plan_type, monthly_message_count, created_at")
        .in("plan_type", selectedPlans.length > 0 ? selectedPlans : ["starter", "professional", "enterprise"]);
      if (error) throw error;
      await loadRevenueTrend(agencies || []);
    } catch (error) {
      console.error("Error loading filtered data:", error);
    }
  };

  const loadRevenueTrend = async (agencies: any[]) => {
    try {
      const months: RevenueChartData[] = [];
      for (let i = chartMonths - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthLabel = format(monthDate, "MMM yy", { locale: tr });

        const newAgenciesInMonth = agencies.filter((a) => {
          const d = new Date(a.created_at);
          return d >= monthStart && d <= monthEnd;
        }).length;

        let txQuery = supabase
          .from("payment_transactions")
          .select("amount, status, plan_type")
          .eq("status", "success")
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString());
        if (selectedPlans.length > 0) txQuery = txQuery.in("plan_type", selectedPlans);
        const { data: transactions } = await txQuery;

        months.push({
          month: monthLabel,
          revenue: transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0,
          newAgencies: newAgenciesInMonth,
        });
      }
      setRevenueChartData(months);
    } catch (error) {
      console.error("Error loading revenue trend:", error);
    }
  };

  const handlePlanToggle = (plan: string) => {
    setSelectedPlans((prev) => (prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan]));
  };

  return {
    superAdminStats, revenueChartData, loading,
    chartMonths, setChartMonths,
    selectedPlans, handlePlanToggle,
    showComparison, setShowComparison,
  };
}
