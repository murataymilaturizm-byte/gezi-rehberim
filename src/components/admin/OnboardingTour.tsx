import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Joyride, STATUS, EVENTS } from "react-joyride";
import type { CallBackProps, Step } from "react-joyride";
import { useIsMobile } from "@/hooks/use-mobile";

interface OnboardingTourProps {
  agencyId: string;
  shouldRun: boolean;
  onComplete: () => void;
}

function getCurrentTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const STORAGE_KEY = (id: string) => `turzz_tour_done_${id}`;

// ─── Rich step content helper ────────────────────────────────────────────────
interface StepContentProps {
  description: string;
  bullets?: string[];
  tip?: string;
  isDark: boolean;
}

function StepContent({ description, bullets = [], tip, isDark }: StepContentProps) {
  // Use CSS variable-based color values that respect the theme.
  // Madde 2: Açık zeminde gövde metni `hsl(222 47% 11%)` (full dark), bullets `hsl(220 13% 28%)`
  // (koyu gri — readable AA contrast ≥ 7:1 on white). Eskiden bullets `hsl(215 16% 47%)` idi
  // ve beyaz zeminde "soluk gri" görünüyordu.
  const textColor = isDark ? "hsl(214 32% 91%)" : "hsl(222 47% 11%)";
  const mutedColor = isDark ? "hsl(215 20% 75%)" : "hsl(220 13% 28%)";
  const tipBg = isDark ? "hsl(24 70% 12%)" : "hsl(38 92% 97%)";
  const tipBorder = isDark ? "hsl(24 50% 28%)" : "hsl(24 97% 83%)";
  const tipColor = isDark ? "hsl(24 94% 73%)" : "hsl(21 90% 40%)";

  return (
    <div style={{ fontSize: 14, lineHeight: 1.65 }}>
      <p style={{ margin: "0 0 10px", color: textColor }}>
        {description}
      </p>
      {bullets.length > 0 && (
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ marginBottom: 5, color: mutedColor }}>{b}</li>
          ))}
        </ul>
      )}
      {tip && (
        <div
          style={{
            background: tipBg,
            border: `1px solid ${tipBorder}`,
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12.5,
            color: tipColor,
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
          <span style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>{tip}</span>
        </div>
      )}
    </div>
  );
}

// ─── Welcome / Complete screens ──────────────────────────────────────────────
function WelcomeContent({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();

  const cards = [
    { icon: "🗺️", text: t("onboardingTour.welcome.cards.tours") },
    { icon: "💬", text: t("onboardingTour.welcome.cards.whatsapp") },
    { icon: "📊", text: t("onboardingTour.welcome.cards.analytics") },
    { icon: "⚡", text: t("onboardingTour.welcome.cards.tools") },
  ];

  const cardBg = isDark ? "hsl(222 47% 15%)" : "hsl(210 40% 96%)";
  const cardText = isDark ? "hsl(210 40% 98%)" : "hsl(222 47% 11%)";
  // Madde 2: Açık zeminde welcome açıklama metni `hsl(220 13% 28%)` (koyu gri, AA contrast).
  const descColor = isDark ? "hsl(215 20% 75%)" : "hsl(220 13% 28%)";

  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: 14, color: descColor, marginBottom: 16, lineHeight: 1.6 }}>
        {t("onboardingTour.welcome.description")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
        {cards.map((c) => (
          <div
            key={c.text}
            style={{
              background: cardBg,
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
              color: cardText,
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
            {c.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompleteContent({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();

  const items = [
    { icon: "⌘K", label: t("onboardingTour.complete.shortcuts.cmdK") },
    { icon: "🔔", label: t("onboardingTour.complete.shortcuts.notifications") },
    { icon: "🔄", label: t("onboardingTour.complete.shortcuts.restart") },
  ];

  const bg = isDark ? "hsl(222 47% 15%)" : "hsl(210 40% 96%)";
  const itemColor = isDark ? "hsl(214 32% 91%)" : "hsl(220 9% 22%)";
  // Madde 2: Complete ekranı açıklama metni — beyaz zeminde okunur koyu gri.
  const descColor = isDark ? "hsl(215 20% 75%)" : "hsl(220 13% 28%)";
  const codeBg = isDark ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.12)";
  const codeColor = isDark ? "hsl(21 94% 73%)" : "hsl(21 90% 46%)";

  return (
    <div>
      <p style={{ fontSize: 14, color: descColor, marginBottom: 14, lineHeight: 1.6 }}>
        {t("onboardingTour.complete.description")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: bg, borderRadius: 8, padding: "8px 12px",
              fontSize: 13, color: itemColor,
              wordBreak: "break-word", overflowWrap: "break-word",
            }}
          >
            <code
              style={{
                background: codeBg,
                color: codeColor,
                borderRadius: 5, padding: "2px 7px", fontSize: 12, fontFamily: "monospace",
                flexShrink: 0,
              }}
            >
              {it.icon}
            </code>
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function OnboardingTour({ agencyId, shouldRun, onComplete }: OnboardingTourProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [runTour, setRunTour] = useState(false);
  const isDark = getCurrentTheme() === "dark";

  // Theme-aware background and foreground using CSS variable equivalents
  const bg = isDark ? "hsl(222 47% 7%)" : "hsl(0 0% 100%)";
  const fg = isDark ? "hsl(210 40% 96%)" : "hsl(222 47% 11%)";

  // Helper to build a step with rich content
  const step = (
    target: string,
    placement: Step["placement"],
    title: string,
    description: string,
    bullets: string[] = [],
    tip?: string,
  ): Step => ({
    target,
    placement,
    title,
    content: <StepContent description={description} bullets={bullets} tip={tip} isDark={isDark} />,
    disableBeacon: true,
  });

  const desktopSteps: Step[] = [
    // 1. Welcome
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.welcome.title"),
      content: <WelcomeContent isDark={isDark} />,
      disableBeacon: true,
    },
    // 2. Dashboard
    step(
      '[data-tour="sidebar-dashboard"]', "right",
      t("onboardingTour.step.dashboard.title"),
      t("onboardingTour.step.dashboard.desc"),
      t("onboardingTour.step.dashboard.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.dashboard.tip"),
    ),
    // 3. Turlar
    step(
      '[data-tour="sidebar-tours"]', "right",
      t("onboardingTour.step.tours.title"),
      t("onboardingTour.step.tours.desc"),
      t("onboardingTour.step.tours.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.tours.tip"),
    ),
    // 4. Rezervasyonlar
    step(
      '[data-tour="sidebar-registrations"]', "right",
      t("onboardingTour.step.registrations.title"),
      t("onboardingTour.step.registrations.desc"),
      t("onboardingTour.step.registrations.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.registrations.tip"),
    ),
    // 5. WhatsApp
    step(
      '[data-tour="sidebar-whatsapp"]', "right",
      t("onboardingTour.step.whatsapp.title"),
      t("onboardingTour.step.whatsapp.desc"),
      t("onboardingTour.step.whatsapp.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.whatsapp.tip"),
    ),
    // 6. Acente Bilgileri
    step(
      '[data-tour="sidebar-agency-info"]', "right",
      t("onboardingTour.step.agencyInfo.title"),
      t("onboardingTour.step.agencyInfo.desc"),
      t("onboardingTour.step.agencyInfo.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.agencyInfo.tip"),
    ),
    // 7. Ödeme Ayarları
    step(
      '[data-tour="sidebar-payment"]', "right",
      t("onboardingTour.step.paymentSettings.title"),
      t("onboardingTour.step.paymentSettings.desc"),
      t("onboardingTour.step.paymentSettings.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.paymentSettings.tip"),
    ),
    // 8. Mesaj Şablonları
    step(
      '[data-tour="sidebar-templates"]', "right",
      t("onboardingTour.step.templates.title"),
      t("onboardingTour.step.templates.desc"),
      t("onboardingTour.step.templates.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.templates.tip"),
    ),
    // 9. SSS
    step(
      '[data-tour="sidebar-faq"]', "right",
      t("onboardingTour.step.faq.title"),
      t("onboardingTour.step.faq.desc"),
      t("onboardingTour.step.faq.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.faq.tip"),
    ),
    // 10. Dil Yönetimi
    step(
      '[data-tour="sidebar-languages"]', "right",
      t("onboardingTour.step.languages.title"),
      t("onboardingTour.step.languages.desc"),
      t("onboardingTour.step.languages.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.languages.tip"),
    ),
    // 11. Planım
    step(
      '[data-tour="sidebar-history"]', "right",
      t("onboardingTour.step.subscription.title"),
      t("onboardingTour.step.subscription.desc"),
      t("onboardingTour.step.subscription.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.subscription.tip"),
    ),
    // 12. Bildirimler
    step(
      '[data-tour="header-notifications"]', "bottom",
      t("onboardingTour.step.notificationsBell.title"),
      t("onboardingTour.step.notificationsBell.desc"),
      t("onboardingTour.step.notificationsBell.bullets", { returnObjects: true }) as string[],
    ),
    // 13. Cmd+K
    step(
      '[data-tour="header-command-palette"]', "bottom",
      t("onboardingTour.step.cmdK.title"),
      t("onboardingTour.step.cmdK.desc"),
      t("onboardingTour.step.cmdK.bullets", { returnObjects: true }) as string[],
      t("onboardingTour.step.cmdK.tip"),
    ),
    // 14. Complete
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.complete.title"),
      content: <CompleteContent isDark={isDark} />,
      disableBeacon: true,
    },
  ];

  const mobileSteps: Step[] = [
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.welcome.title"),
      content: <WelcomeContent isDark={isDark} />,
      disableBeacon: true,
    },
    step(
      '[data-tour="mobile-menu-button"]', "bottom",
      t("onboardingTour.step.mobileMenu.title"),
      t("onboardingTour.step.mobileMenu.desc"),
      t("onboardingTour.step.mobileMenu.bullets", { returnObjects: true }) as string[],
    ),
    step(
      '[data-tour="header-notifications"]', "bottom",
      t("onboardingTour.step.mobileNotifications.title"),
      t("onboardingTour.step.mobileNotifications.desc"),
      t("onboardingTour.step.mobileNotifications.bullets", { returnObjects: true }) as string[],
    ),
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.complete.title"),
      content: <CompleteContent isDark={isDark} />,
      disableBeacon: true,
    },
  ];

  const steps = isMobile ? mobileSteps : desktopSteps;

  useEffect(() => {
    // Madde 1: Mobilde onboarding rehberi HİÇ açılmasın. Küçük ekranda 14 adımlık
    // joyride deneyimi kötü — kullanıcı "Atla" basmak zorunda kalmasın. localStorage'a
    // yine işaretle ki masaüstüne geçtiğinde tekrar açılmasın (zaten görmüş sayılıyor).
    if (shouldRun && isMobile) {
      if (agencyId) localStorage.setItem(STORAGE_KEY(agencyId), "1");
      onComplete();
      return;
    }
    if (shouldRun) {
      const timer = setTimeout(() => {
        // localStorage'a hemen yaz — sekme kapansa bile bir daha gösterilmez
        if (agencyId) localStorage.setItem(STORAGE_KEY(agencyId), "1");
        setRunTour(true);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [shouldRun, agencyId, isMobile, onComplete]);

  const handleCallback = (data: CallBackProps) => {
    const { status, type } = data;
    const ended =
      type === EVENTS.TOUR_END ||
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED;
    if (ended) {
      setRunTour(false);
      localStorage.setItem(STORAGE_KEY(agencyId), "1");
      onComplete();
    }
  };

  // Madde 1: mobilde render etme — joyride state'i bile başlatma
  if (isMobile) return null;
  if (!runTour) return null;

  return (
    <Joyride
      steps={steps}
      run={runTour}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableOverlayClose
      spotlightClicks
      callback={handleCallback}
      locale={{
        back: t("onboardingTour.back"),
        close: t("onboardingTour.close"),
        last: t("onboardingTour.finish"),
        next: t("onboardingTour.next"),
        skip: t("onboardingTour.skip"),
      }}
      styles={{
        options: {
          backgroundColor: bg,
          textColor: fg,
          primaryColor: "hsl(16 95% 55%)",
          arrowColor: bg,
          overlayColor: "rgba(0,0,0,0.6)",
          spotlightShadow: "0 0 0 3px hsl(16 95% 55% / 0.4), 0 0 30px rgba(0,0,0,0.3)",
          zIndex: 10000,
          width: isMobile ? 320 : 460,
        },
        tooltip: {
          borderRadius: 14,
          padding: "20px 22px",
          boxShadow: isDark
            ? "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)"
            : "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)",
        },
        tooltipTitle: {
          fontSize: 17,
          fontWeight: 700,
          marginBottom: 10,
          color: fg,
          lineHeight: 1.4,
        },
        tooltipContent: {
          padding: "0 0 4px",
          fontSize: 14,
        },
        tooltipFooter: {
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
        },
        buttonNext: {
          backgroundColor: "hsl(16 95% 55%)",
          borderRadius: 8,
          padding: "9px 20px",
          fontSize: 14,
          fontWeight: 600,
          border: "none",
          boxShadow: "0 2px 8px rgba(249,115,22,0.35)",
          cursor: "pointer",
        },
        buttonBack: {
          color: isDark ? "hsl(215 20% 65%)" : "hsl(215 16% 47%)",
          fontSize: 13,
          marginRight: 10,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        },
        buttonSkip: {
          color: isDark ? "hsl(215 20% 65%)" : "hsl(215 16% 47%)",
          fontSize: 13,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        },
        buttonClose: {
          color: isDark ? "hsl(215 20% 65%)" : "hsl(215 16% 47%)",
          width: 28,
          height: 28,
        },
        spotlight: {
          borderRadius: 10,
        },
        overlay: {
          mixBlendMode: "normal",
        },
      }}
    />
  );
}

export { STORAGE_KEY as tourStorageKey };
