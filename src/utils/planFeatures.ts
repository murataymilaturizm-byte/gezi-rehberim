import { supabase } from "@/integrations/supabase/client";

export interface PlanFeatures {
  plan_type: string;
  max_tours: number;
  max_languages: number;
  available_styles: string[];
  has_user_profiles: boolean;
  has_reminders: boolean;
  has_follow_ups: boolean;
  has_templates: boolean;
  has_feedback: boolean;
  has_analytics: boolean;
  message_limit: number;
}

let cachedFeatures: Record<string, PlanFeatures> | null = null;

export async function getPlanFeatures(planType: string): Promise<PlanFeatures | null> {
  // Cache'den kontrol et
  if (cachedFeatures && cachedFeatures[planType]) {
    return cachedFeatures[planType];
  }

  try {
    const { data, error } = await supabase
      .from('plan_features')
      .select('*')
      .eq('plan_type', planType)
      .single();

    if (error) throw error;

    // Cache'e ekle
    if (!cachedFeatures) cachedFeatures = {};
    cachedFeatures[planType] = data;

    return data;
  } catch (error) {
    console.error('Error loading plan features:', error);
    return null;
  }
}

export async function canUseFeature(
  planType: string,
  feature: keyof Pick<
    PlanFeatures,
    'has_user_profiles' | 'has_reminders' | 'has_follow_ups' | 'has_templates' | 'has_feedback' | 'has_analytics'
  >
): Promise<boolean> {
  const features = await getPlanFeatures(planType);
  return features ? features[feature] : false;
}

export async function getAvailableStyles(planType: string): Promise<string[]> {
  const features = await getPlanFeatures(planType);
  return features ? features.available_styles : ['professional'];
}

export async function getMaxLanguages(planType: string): Promise<number> {
  const features = await getPlanFeatures(planType);
  return features ? features.max_languages : 1;
}

export async function getMaxTours(planType: string): Promise<number> {
  const features = await getPlanFeatures(planType);
  return features ? features.max_tours : 10;
}

export function clearPlanFeaturesCache() {
  cachedFeatures = null;
}

// -1 veya 9999+ = sınırsız. Tur ekleme kontrolü ve gösterim için kullan.
export function isUnlimitedTours(maxTours: number): boolean {
  return maxTours === -1 || maxTours >= 9999;
}

// Mevcut tur sayısı limit dahilinde mi?
export function isWithinTourLimit(currentCount: number, maxTours: number): boolean {
  if (isUnlimitedTours(maxTours)) return true;
  return currentCount < maxTours;
}
