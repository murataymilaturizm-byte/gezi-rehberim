import { useState, useEffect } from "react";
import { Joyride, STATUS, EVENTS } from "react-joyride";
import type { CallBackProps, Step } from "react-joyride";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";

interface OnboardingTourProps {
  agencyId: string;
  shouldRun: boolean;
  onComplete: () => void;
}

function getCurrentTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const STORAGE_KEY = (agencyId: string) => `turzz_tour_done_${agencyId}`;

export function OnboardingTour({ agencyId, shouldRun, onComplete }: OnboardingTourProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [runTour, setRunTour] = useState(false);
  const isDark = getCurrentTheme() === "dark";

  const desktopSteps: Step[] = [
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.welcome.title"),
      content: t("onboardingTour.welcome.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="sidebar-dashboard"]',
      placement: "right",
      title: t("onboardingTour.dashboard.title"),
      content: t("onboardingTour.dashboard.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="sidebar-agency-info"]',
      placement: "right",
      title: t("onboardingTour.agencyInfo.title"),
      content: t("onboardingTour.agencyInfo.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="sidebar-tours"]',
      placement: "right",
      title: t("onboardingTour.tours.title"),
      content: t("onboardingTour.tours.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="sidebar-whatsapp"]',
      placement: "right",
      title: t("onboardingTour.whatsapp.title"),
      content: t("onboardingTour.whatsapp.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="header-notifications"]',
      placement: "bottom",
      title: t("onboardingTour.notifications.title"),
      content: t("onboardingTour.notifications.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="header-command-palette"]',
      placement: "bottom",
      title: t("onboardingTour.commandPalette.title"),
      content: t("onboardingTour.commandPalette.content"),
      disableBeacon: true,
    },
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.complete.title"),
      content: t("onboardingTour.complete.content"),
      disableBeacon: true,
    },
  ];

  const mobileSteps: Step[] = [
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.welcome.title"),
      content: t("onboardingTour.welcome.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="mobile-menu-button"]',
      placement: "bottom",
      title: t("onboardingTour.mobileMenu.title"),
      content: t("onboardingTour.mobileMenu.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="header-notifications"]',
      placement: "bottom",
      title: t("onboardingTour.notifications.title"),
      content: t("onboardingTour.notifications.content"),
      disableBeacon: true,
    },
    {
      target: "body",
      placement: "center",
      title: t("onboardingTour.complete.title"),
      content: t("onboardingTour.complete.content"),
      disableBeacon: true,
    },
  ];

  const steps = isMobile ? mobileSteps : desktopSteps;

  useEffect(() => {
    if (shouldRun) {
      const timer = setTimeout(() => setRunTour(true), 900);
      return () => clearTimeout(timer);
    }
  }, [shouldRun]);

  // Uncontrolled mode — TOUR_END veya FINISHED/SKIPPED her türlü kapanışı yakalar
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

  if (!runTour) return null;

  const bg = isDark ? "hsl(222.2 84% 4.9%)" : "#ffffff";
  const fg = isDark ? "#f8fafc" : "hsl(222.2 84% 4.9%)";

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
          overlayColor: "rgba(0,0,0,0.55)",
          spotlightShadow: "0 0 20px rgba(0,0,0,0.4)",
          zIndex: 10000,
          width: 380,
        },
        tooltip: {
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        },
        tooltipTitle: {
          fontSize: 17,
          fontWeight: 600,
          marginBottom: 6,
        },
        tooltipContent: {
          fontSize: 14,
          lineHeight: 1.6,
          paddingTop: 4,
        },
        buttonNext: {
          backgroundColor: "hsl(16 95% 55%)",
          borderRadius: 8,
          padding: "8px 18px",
          fontSize: 14,
          fontWeight: 500,
          border: "none",
        },
        buttonBack: {
          color: isDark ? "#94a3b8" : "#64748b",
          fontSize: 14,
          marginRight: 8,
          background: "transparent",
          border: "none",
        },
        buttonSkip: {
          color: isDark ? "#94a3b8" : "#64748b",
          fontSize: 13,
          background: "transparent",
          border: "none",
        },
        buttonClose: {
          color: isDark ? "#94a3b8" : "#64748b",
        },
        spotlight: {
          borderRadius: 8,
        },
      }}
    />
  );
}

export { STORAGE_KEY as tourStorageKey };
