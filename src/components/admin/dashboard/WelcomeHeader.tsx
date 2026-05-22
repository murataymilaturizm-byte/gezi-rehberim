import { useTranslation } from "react-i18next";
import { AIMascot } from "@/components/landing/AIMascot";
import { cn } from "@/lib/utils";

interface WelcomeHeaderProps {
  agencyName: string;
  todayRegistrations: number;
  todayRevenue: number;
  pendingCount: number;
  currency?: string;
  /** WhatsApp bot durumu — yeşil "Çevrimiçi" veya turuncu uyarı */
  whatsappStatus?: string;
}

export function WelcomeHeader({
  agencyName,
  todayRegistrations,
  todayRevenue,
  pendingCount,
  currency = "₺",
  whatsappStatus,
}: WelcomeHeaderProps) {
  const { t } = useTranslation();
  const hour = new Date().getHours();

  const greeting =
    hour < 6
      ? t("greetings.night", { defaultValue: "İyi geceler" })
      : hour < 12
      ? t("greetings.morning", { defaultValue: "Günaydın" })
      : hour < 18
      ? t("greetings.afternoon", { defaultValue: "İyi öğleden sonralar" })
      : t("greetings.evening", { defaultValue: "İyi akşamlar" });

  const isBotOnline = whatsappStatus === "active";

  return (
    <div className="mb-6 sm:mb-8 flex items-center gap-3 sm:gap-4">
      {/* Sol: küçük AIMascot + bot durumu — landing kalitesinde görsel */}
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <AIMascot className="max-w-[56px] sm:max-w-[68px]" />
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap",
            isBotOnline
              ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
              : "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              isBotOnline ? "bg-green-500 animate-pulse" : "bg-orange-500",
            )}
          />
          {isBotOnline
            ? t("dashboard.botOnline", { defaultValue: "Çevrimiçi" })
            : t("dashboard.botOffline", { defaultValue: "Bağlı değil" })}
        </span>
      </div>

      {/* Sağ: greeting + bugünün özeti */}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl font-bold leading-tight">
          {greeting}{agencyName ? `, ${agencyName}` : ""}! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {todayRegistrations > 0 ? (
            <>
              {t("dashboard.welcome.todayStats", {
                defaultValue: "Bugün {{count}} yeni rezervasyon",
                count: todayRegistrations,
              })}{" "}
              ·{" "}
              <span className="font-medium text-foreground">
                {todayRevenue.toLocaleString("tr-TR")}{currency}
              </span>{" "}
              {t("dashboard.welcome.revenue", { defaultValue: "gelir" })}
              {pendingCount > 0 && (
                <span className="ml-2 text-orange-600 dark:text-orange-400 font-medium">
                  · {pendingCount} {t("dashboard.welcome.pending", { defaultValue: "bekliyor" })}
                </span>
              )}
            </>
          ) : (
            <>
              {isBotOnline
                ? t("dashboard.welcome.noRegistrations", {
                    defaultValue: "Bugün henüz rezervasyon yok. WhatsApp botunuz çalışıyor! 💬",
                  })
                : t("dashboard.welcome.botNotConnected", {
                    defaultValue: "WhatsApp henüz bağlı değil. İlk müşterilerinizi karşılamak için ayarlardan bağlayın.",
                  })}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
