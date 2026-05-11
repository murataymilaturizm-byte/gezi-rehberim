/**
 * Meta (Facebook) Pixel — consent-aware yükleme.
 * Sadece kullanıcı "marketing" çerezlerine onay verdiğinde yüklenir.
 * index.html'deki statik pixel kodu kaldırıldı.
 */
import { useEffect } from "react";
import { getConsent } from "./CookieConsent";

const PIXEL_ID = "1240169247981795";

declare global {
  interface Window {
    fbq: ((...args: any[]) => void) & { callMethod?: (...args: any[]) => void; queue?: any[]; loaded?: boolean; version?: string; push?: any };
    _fbq: typeof window.fbq;
  }
}

function loadPixel() {
  if (window.fbq) return; // zaten yüklü

  const n: any = function (...args: any[]) {
    n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
  };
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  window.fbq = n;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");
}

export function MetaPixel() {
  useEffect(() => {
    function check() {
      const consent = getConsent();
      if (consent?.marketing) loadPixel();
    }

    check();
    window.addEventListener("consent-updated", check);
    return () => window.removeEventListener("consent-updated", check);
  }, []);

  return null;
}
