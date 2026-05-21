import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "turzz_onboarding_dismissed";

interface OnboardingChecklistProps {
  agencyId: string;
  onNavigate: (tab: string) => void;
}

interface StepStatus {
  agencyInfo: boolean;
  payment: boolean;
  addTour: boolean;
  addDates: boolean;
  whatsapp: boolean;
}

export function OnboardingChecklist({ agencyId, onNavigate }: OnboardingChecklistProps) {
  const { t } = useTranslation();
  const [steps, setSteps] = useState<StepStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY + "_" + agencyId) === "1";
  });

  useEffect(() => {
    if (dismissed) return;
    loadSteps();
  }, [agencyId, dismissed]);

  const loadSteps = async () => {
    const [agencyRes, toursRes, datesRes] = await Promise.all([
      supabase
        .from("agencies")
        .select("phone_public, address, payment_instructions, whatsapp_status, meta_phone_number_id, whatsapp_api_key")
        .eq("id", agencyId)
        .single(),
      supabase
        .from("tours")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId),
      supabase
        .from("tour_dates")
        .select("id", { count: "exact", head: true })
        .in(
          "tour_id",
          (
            await supabase
              .from("tours")
              .select("id")
              .eq("agency_id", agencyId)
          ).data?.map((t) => t.id) ?? []
        ),
    ]);

    const agency = agencyRes.data;
    const tourCount = toursRes.count ?? 0;
    const dateCount = datesRes.count ?? 0;

    setSteps({
      agencyInfo: !!(agency?.phone_public && agency?.address),
      payment: !!(agency?.payment_instructions),
      addTour: tourCount > 0,
      addDates: dateCount > 0,
      whatsapp: agency?.whatsapp_status === "active" && !!(agency?.meta_phone_number_id || agency?.whatsapp_api_key),
    });
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY + "_" + agencyId, "1");
    setDismissed(true);
  };

  if (dismissed || !steps) return null;

  const stepList: { key: keyof StepStatus; tab: string }[] = [
    { key: "agencyInfo", tab: "agency_info" },
    { key: "payment", tab: "payment_settings" },
    { key: "addTour", tab: "tours" },
    { key: "addDates", tab: "tours" },
    { key: "whatsapp", tab: "settings" },
  ];

  const completedCount = stepList.filter((s) => steps[s.key]).length;
  const allDone = completedCount === stepList.length;

  if (allDone) return null;

  const percent = Math.round((completedCount / stepList.length) * 100);

  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-sm font-semibold">
              {t("admin.onboarding.title")} —{" "}
              <span className="text-primary">
                {t("admin.onboarding.progress", { percent })}
              </span>
            </CardTitle>
            <Progress value={percent} className="h-1.5" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            title={t("admin.onboarding.dismiss")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
          {stepList.map(({ key, tab }) => {
            const done = steps[key];
            return (
              <button
                key={key}
                onClick={() => !done && onNavigate(tab)}
                disabled={done}
                className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                  done
                    ? "text-muted-foreground cursor-default"
                    : "text-foreground hover:bg-accent cursor-pointer"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={done ? "line-through" : ""}>
                  {t(`admin.onboarding.steps.${key}`)}
                </span>
                {!done && (
                  <span className="ml-auto text-primary shrink-0">
                    {t(`admin.onboarding.actions.${key}`)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
