import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, XCircle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QuotaWarningBannerProps {
  agencyId: string;
  onNavigateToPlan: () => void;
}

export function QuotaWarningBanner({ agencyId, onNavigateToPlan }: QuotaWarningBannerProps) {
  const { t } = useTranslation();
  const [used, setUsed] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("agencies")
      .select("monthly_message_count, message_limit")
      .eq("id", agencyId)
      .single();
    if (data) {
      setUsed(data.monthly_message_count ?? 0);
      setLimit(data.message_limit ?? 0);
    }
  }, [agencyId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (used === null || limit === null || limit <= 0 || limit === -1) return null;

  const percent = Math.min(Math.round((used / limit) * 100), 100);
  if (percent < 80) return null;

  const isCritical = percent >= 95;

  return (
    <Alert
      className={`border ${
        isCritical
          ? "border-destructive bg-destructive/10"
          : "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
      }`}
    >
      {isCritical ? (
        <XCircle className="h-4 w-4 text-destructive" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-orange-500" />
      )}
      <AlertDescription className="ml-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 space-y-1 min-w-0">
            <p className={`text-sm font-medium ${isCritical ? "text-destructive" : "text-orange-700 dark:text-orange-400"}`}>
              {isCritical
                ? t("admin.quotaBanner.critical", { percent })
                : t("admin.quotaBanner.warning", { percent })}
            </p>
            <div className="flex items-center gap-2">
              <Progress value={percent} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground shrink-0">
                {used.toLocaleString()} / {limit.toLocaleString()}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant={isCritical ? "destructive" : "default"}
            onClick={onNavigateToPlan}
            className="shrink-0"
          >
            <TrendingUp className="w-3 h-3 mr-1" />
            {t("admin.quotaBanner.upgrade")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
