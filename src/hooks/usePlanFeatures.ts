import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMaxTours, getPlanFeatures, PlanFeatures } from "@/utils/planFeatures";

export const usePlanFeatures = (userAgencyId: string | null, isSuperAdmin: boolean) => {
  const [planType, setPlanType] = useState<string>('starter');
  const [maxTours, setMaxTours] = useState<number>(10);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([]);

  useEffect(() => {
    if (userAgencyId && !isSuperAdmin) {
      loadAgencyPlan();
    }
  }, [userAgencyId, isSuperAdmin]);

  const loadAgencyPlan = async () => {
    if (!userAgencyId) return;

    try {
      const { data: agencyData, error } = await supabase
        .from("agencies")
        .select("plan_type, enabled_languages")
        .eq("id", userAgencyId)
        .single();

      if (error) throw error;

      if (agencyData) {
        const plan = agencyData.plan_type || 'starter';
        setPlanType(plan);
        const maxToursValue = await getMaxTours(plan);
        const features = await getPlanFeatures(plan);
        setMaxTours(maxToursValue);
        setPlanFeatures(features);
        setEnabledLanguages(agencyData.enabled_languages || []);
      }
    } catch (error) {
      console.error("Error loading agency plan:", error);
    }
  };

  return {
    planType,
    maxTours,
    planFeatures,
    enabledLanguages,
    loadAgencyPlan
  };
};
