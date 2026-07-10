import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Check, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { computeTourCompleteness } from "@/utils/tourCompleteness";

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
  toursComplete: boolean;   // Panel-1: tüm turların kritik-alanları dolu mu
  selectLanguage: boolean;
  currencyLanguage: boolean;
  whatsapp: boolean;
  // Madde 3: approveTemplate ve addFaq KALDIRILDI — onboarding'in zorunlu adımları değil,
  // ayrı menüde yapılabilir. WhatsApp listenin EN SONUNA alındı (kurulumun son adımı).
}

export function OnboardingChecklist({ agencyId, onNavigate }: OnboardingChecklistProps) {
  const { t } = useTranslation();
  const [steps, setSteps] = useState<StepStatus | null>(null);
  const [tourStats, setTourStats] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY + "_" + agencyId) === "1";
  });

  useEffect(() => {
    if (dismissed) return;
    loadSteps();
  }, [agencyId, dismissed]);

  const loadSteps = async () => {
    // Panel-1: tur alanlarını da çek (doluluk hesabı için) — id-only yerine.
    const tourIdsRes = await supabase
      .from("tours")
      .select("id, type, tur_kategorisi, hareket_noktasi, toplanma_saati, tur_sure, ulasim, gezilecek_yerler, konaklama, visa_required")
      .eq("agency_id", agencyId);

    const tourRows = tourIdsRes.data ?? [];
    const tourIds = tourRows.map((t) => t.id);

    // Panel-1: kaç tur kritik-alan bakımından TAM (koşullu set: konaklama/vize).
    const completeCount = tourRows.filter((tr) => computeTourCompleteness(tr).missing.length === 0).length;
    setTourStats({ done: completeCount, total: tourRows.length });

    // Madde 3: message_templates ve faq_templates sorguları KALDIRILDI — bu iki adım
    // onboarding checklist'inden çıkarıldı.
    const [agencyRes, toursRes, datesRes] = await Promise.all([
      supabase
        .from("agencies")
        .select("phone_public, address, payment_instructions, whatsapp_status, meta_phone_number_id, whatsapp_api_key, enabled_languages, primary_currency, language_currencies")
        .eq("id", agencyId)
        .single(),
      supabase
        .from("tours")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId),
      tourIds.length > 0
        ? supabase
            .from("tour_dates")
            .select("id", { count: "exact", head: true })
            .in("tour_id", tourIds)
        : Promise.resolve({ count: 0 }),
    ]);

    const agency = agencyRes.data;
    const tourCount = toursRes.count ?? 0;
    const dateCount = datesRes.count ?? 0;

    const langCurrencies = agency?.language_currencies as Record<string, string> | null;
    const hasCurrencyLang =
      !!(agency?.primary_currency) ||
      (langCurrencies != null && Object.keys(langCurrencies).length > 0);

    setSteps({
      agencyInfo: !!(agency?.phone_public && agency?.address),
      payment: !!(agency?.payment_instructions),
      addTour: tourCount > 0,
      addDates: dateCount > 0,
      // Panel-1: en az 1 tur VAR ve HEPSİ kritik-alan bakımından tam.
      toursComplete: tourCount > 0 && completeCount === tourRows.length,
      selectLanguage: Array.isArray(agency?.enabled_languages) && agency.enabled_languages.length > 0,
      currencyLanguage: hasCurrencyLang,
      whatsapp: agency?.whatsapp_status === "active" && !!(agency?.meta_phone_number_id || agency?.whatsapp_api_key),
    });
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY + "_" + agencyId, "1");
    setDismissed(true);
  };

  if (dismissed || !steps) return null;

  // Madde 3: Sıra: önce kurulum (agency, payment, tur, tarih, dil, dil-para),
  // EN SON WhatsApp bağlantısı. approveTemplate ve addFaq KALDIRILDI.
  const stepList: { key: keyof StepStatus; tab: string }[] = [
    { key: "agencyInfo", tab: "agency_info" },
    { key: "payment", tab: "payment_settings" },
    { key: "addTour", tab: "tours" },
    { key: "addDates", tab: "tours" },
    { key: "toursComplete", tab: "tours" },
    { key: "selectLanguage", tab: "languages" },
    { key: "currencyLanguage", tab: "languages" },
    { key: "whatsapp", tab: "settings" },
  ];

  // İlerleme sayacı otomatik: completedCount / stepList.length (artık 7).
  const completedCount = stepList.filter((s) => steps[s.key]).length;
  const allDone = completedCount === stepList.length;

  if (allDone) return null;

  const percent = Math.round((completedCount / stepList.length) * 100);

  // KRİTİK ADIMLAR: WhatsApp bağlamadan önce dolması GEREKEN setup adımları
  // (agencyInfo, payment, selectLanguage). Eksikse uyarı çıkar.
  // WhatsApp adımı yapıldıysa veya tüm kritikler tamamsa uyarı yumuşar/kaybolur.
  const _criticalDone = steps.agencyInfo && steps.payment && steps.selectLanguage;
  const _whatsappDone = steps.whatsapp;
  const _showCriticalWarning = !_criticalDone && !_whatsappDone;

  return (
    <div className="space-y-3">
      {/* KRİTİK SETUP UYARISI — kullanıcı kararı: teşvik, wizard değil */}
      {_showCriticalWarning && (
        <Alert className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-900 dark:text-amber-200">
            {t("admin.onboarding.criticalSetupWarning", {
              defaultValue:
                "Ayarlarınızı (acente bilgileri, ödeme, dil) tamamlamadan WhatsApp'ı bağlarsanız, bot müşterilere eksik veya yanlış bilgi verebilir. Önce kurulumu tamamlamanız önerilir.",
            })}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-primary/20 shadow-sm dark:border-primary/10">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">
                {t("admin.onboarding.title")}
              </CardTitle>
              <Badge variant="secondary" className="text-[11px] h-5 px-1.5">
                {completedCount}/{stepList.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={percent} className="h-1.5 flex-1" />
              <span className="text-xs font-semibold text-primary shrink-0 tabular-nums">
                {t("admin.onboarding.progress", { percent })}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 -mt-0.5 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            title={t("admin.onboarding.dismiss")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stepList.map(({ key, tab }, index) => {
            const done = steps[key];
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all",
                  done
                    ? "border-green-500/20 bg-green-500/5 dark:bg-green-500/[0.04]"
                    : "border-border bg-card hover:border-primary/30 hover:bg-accent/30"
                )}
              >
                {/* Step indicator: number or checkmark */}
                <div
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold",
                    done
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step title */}
                <span
                  className={cn(
                    "flex-1 text-xs font-medium leading-tight",
                    done
                      ? "text-muted-foreground line-through decoration-muted-foreground/40"
                      : "text-foreground"
                  )}
                >
                  {key === "toursComplete"
                    ? t("admin.onboarding.steps.toursComplete", {
                        done: tourStats.done,
                        total: tourStats.total,
                        defaultValue: `Tur bilgileri eksiksiz (${tourStats.done}/${tourStats.total} tur tam)`,
                      })
                    : t(`admin.onboarding.steps.${key}`)}
                </span>

                {/* Right: action button or done checkmark */}
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/10 shrink-0 font-semibold"
                    onClick={() => onNavigate(tab)}
                  >
                    {t(`admin.onboarding.actions.${key}`)}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
