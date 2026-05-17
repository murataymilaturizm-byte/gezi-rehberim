import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Cookie, X, ChevronDown } from "lucide-react";

const CONSENT_KEY = "turzz_cookie_consent";
const CONSENT_VERSION = "1.0";

export interface ConsentSettings {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: string;
  timestamp: string;
}

export function getConsent(): ConsentSettings | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentSettings;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConsent(settings: { analytics: boolean; marketing: boolean }): ConsentSettings {
  const full: ConsentSettings = {
    necessary: true,
    analytics: settings.analytics,
    marketing: settings.marketing,
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(full));
  window.dispatchEvent(new Event("consent-updated"));
  return full;
}

export function CookieConsent() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Kısa gecikme: sayfa render olduktan sonra göster (CLS önleme)
    const timer = setTimeout(() => {
      if (!getConsent()) setShow(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  function acceptAll() {
    saveConsent({ analytics: true, marketing: true });
    setShow(false);
  }

  function rejectAll() {
    saveConsent({ analytics: false, marketing: false });
    setShow(false);
  }

  function saveCustom() {
    saveConsent({ analytics, marketing });
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 start-0 end-0 z-[200] border-t border-border bg-card shadow-2xl animate-in slide-in-from-bottom duration-300"
      role="dialog"
      aria-labelledby="cookie-title"
      aria-modal="false"
    >
      <div className="container mx-auto max-w-5xl px-4 py-4">
        {!showDetails ? (
          /* ── Kompakt görünüm ── */
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Cookie className="h-5 w-5 flex-shrink-0 text-primary mt-0.5 sm:mt-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <p id="cookie-title" className="text-sm font-semibold text-foreground">
                {t("cookies.title")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("cookies.description")}{" "}
                <a href="/privacy-policy" className="underline hover:text-primary transition-colors">
                  {t("cookies.learnMore")}
                </a>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto">
              <button
                onClick={() => setShowDetails(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline flex items-center gap-1 transition-colors"
              >
                {t("cookies.customize")}
                <ChevronDown className="h-3 w-3" />
              </button>
              <Button variant="outline" size="sm" onClick={rejectAll} className="h-8 text-xs">
                {t("cookies.rejectAll")}
              </Button>
              <Button size="sm" onClick={acceptAll} className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                {t("cookies.acceptAll")}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Detay görünümü ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("cookies.customizeTitle")}</h2>
              <button
                onClick={() => setShowDetails(false)}
                aria-label={t("common.close") || "Close"}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 divide-y divide-border">
              {/* Zorunlu */}
              <div className="flex items-start justify-between gap-4 pb-3">
                <div>
                  <p className="text-sm font-medium">{t("cookies.necessary.title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("cookies.necessary.description")}</p>
                </div>
                <Switch checked disabled aria-label={t("cookies.necessary.title")} className="shrink-0 mt-0.5" />
              </div>

              {/* Analitik */}
              <div className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t("cookies.analytics.title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("cookies.analytics.description")}</p>
                </div>
                <Switch
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                  aria-label={t("cookies.analytics.title")}
                  className="shrink-0 mt-0.5"
                />
              </div>

              {/* Pazarlama */}
              <div className="flex items-start justify-between gap-4 pt-3">
                <div>
                  <p className="text-sm font-medium">{t("cookies.marketing.title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("cookies.marketing.description")}</p>
                </div>
                <Switch
                  checked={marketing}
                  onCheckedChange={setMarketing}
                  aria-label={t("cookies.marketing.title")}
                  className="shrink-0 mt-0.5"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={rejectAll} className="h-8 text-xs">
                {t("cookies.rejectAll")}
              </Button>
              <Button size="sm" onClick={saveCustom} className="h-8 text-xs">
                {t("cookies.savePreferences")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
