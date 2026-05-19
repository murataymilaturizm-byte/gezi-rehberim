import { useTranslation } from "react-i18next";

interface WelcomeHeaderProps {
  agencyName: string;
  todayRegistrations: number;
  todayRevenue: number;
  pendingCount: number;
  currency?: string;
}

export function WelcomeHeader({
  agencyName,
  todayRegistrations,
  todayRevenue,
  pendingCount,
  currency = "₺",
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

  return (
    <div className="mb-2">
      <h1 className="text-xl sm:text-2xl font-bold">
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
          <>{t("dashboard.welcome.noRegistrations", { defaultValue: "Bugün henüz rezervasyon yok. WhatsApp botunuz çalışıyor! 💬" })}</>
        )}
      </p>
    </div>
  );
}
