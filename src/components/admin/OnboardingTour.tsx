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

// Faz Tema-uyum: Önceki versiyon dark/light için ayrı hardcoded HSL renkleri
// tutuyordu (`hsl(222 47% 11%)` vb.) → site temasının renk skalasıyla uyuşmuyordu
// (site krem-turuncu, tour mavi-gri) ve özellikle dark mode'da kart/metin tonları
// kırılıyordu. Çözüm: tüm renkleri `hsl(var(--token))` referanslarıyla bağla →
// browser CSS değişkenini runtime'da çözer, tema toggle'ı otomatik tutar.

const STORAGE_KEY = (id: string) => `turzz_tour_done_${id}`;

// ─── Rich step content helper ────────────────────────────────────────────────
interface StepContentProps {
  description: string;
  bullets?: string[];
  tip?: string;
}

function StepContent({ description, bullets = [], tip }: StepContentProps) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.65 }}>
      <p style={{ margin: "0 0 10px", color: "hsl(var(--popover-foreground))" }}>
        {description}
      </p>
      {bullets.length > 0 && (
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ marginBottom: 5, color: "hsl(var(--muted-foreground))" }}>{b}</li>
          ))}
        </ul>
      )}
      {tip && (
        <div
          style={{
            background: "hsl(var(--accent))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12.5,
            color: "hsl(var(--accent-foreground))",
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
function WelcomeContent() {
  const { t } = useTranslation();

  const cards = [
    { icon: "🗺️", text: t("onboardingTour.welcome.cards.tours") },
    { icon: "💬", text: t("onboardingTour.welcome.cards.whatsapp") },
    { icon: "📊", text: t("onboardingTour.welcome.cards.analytics") },
    { icon: "⚡", text: t("onboardingTour.welcome.cards.tools") },
  ];

  return (
    <div style={{ textAlign: "center" }}>
      <p
        style={{
          fontSize: 14,
          color: "hsl(var(--muted-foreground))",
          marginBottom: 16,
          lineHeight: 1.6,
        }}
      >
        {t("onboardingTour.welcome.description")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
        {cards.map((c) => (
          <div
            key={c.text}
            style={{
              background: "hsl(var(--muted))",
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
              color: "hsl(var(--foreground))",
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

function CompleteContent() {
  const { t } = useTranslation();

  const items = [
    { icon: "⌘K", label: t("onboardingTour.complete.shortcuts.cmdK") },
    { icon: "🔔", label: t("onboardingTour.complete.shortcuts.notifications") },
    { icon: "🔄", label: t("onboardingTour.complete.shortcuts.restart") },
  ];

  return (
    <div>
      <p
        style={{
          fontSize: 14,
          color: "hsl(var(--muted-foreground))",
          marginBottom: 14,
          lineHeight: 1.6,
        }}
      >
        {t("onboardingTour.complete.description")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "hsl(var(--muted))",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              color: "hsl(var(--foreground))",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            <code
              style={{
                background: "hsl(var(--primary) / 0.15)",
                color: "hsl(var(--primary))",
                borderRadius: 5,
                padding: "2px 7px",
                fontSize: 12,
                fontFamily: "monospace",
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
    content: <StepContent description={description} bullets={bullets} tip={tip} />,
    disableBeacon: true,
  });

  const desktopSteps: Step[] = [
    // 1. Welcome
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.welcome.title"),
      content: <WelcomeContent />,
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
      content: <CompleteContent />,
      disableBeacon: true,
    },
  ];

  const mobileSteps: Step[] = [
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.welcome.title"),
      content: <WelcomeContent />,
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
      content: <CompleteContent />,
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
          backgroundColor: "hsl(var(--popover))",
          textColor: "hsl(var(--popover-foreground))",
          primaryColor: "hsl(var(--primary))",
          arrowColor: "hsl(var(--popover))",
          overlayColor: "rgba(0,0,0,0.6)",
          spotlightShadow: "0 0 0 3px hsl(var(--primary) / 0.4), 0 0 30px rgba(0,0,0,0.3)",
          zIndex: 10000,
          width: isMobile ? 320 : 460,
        },
        tooltip: {
          borderRadius: 14,
          padding: "20px 22px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px hsl(var(--border))",
        },
        tooltipTitle: {
          fontSize: 17,
          fontWeight: 700,
          marginBottom: 10,
          color: "hsl(var(--popover-foreground))",
          lineHeight: 1.4,
        },
        tooltipContent: {
          padding: "0 0 4px",
          fontSize: 14,
        },
        tooltipFooter: {
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid hsl(var(--border))",
        },
        buttonNext: {
          backgroundColor: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          borderRadius: 8,
          padding: "9px 20px",
          fontSize: 14,
          fontWeight: 600,
          border: "none",
          boxShadow: "0 2px 8px hsl(var(--primary) / 0.35)",
          cursor: "pointer",
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
          fontSize: 13,
          marginRight: 10,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        },
        buttonSkip: {
          color: "hsl(var(--muted-foreground))",
          fontSize: 13,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        },
        buttonClose: {
          color: "hsl(var(--muted-foreground))",
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
