/**
 * Meta (Facebook) Pixel — consent-aware yükleme.
 * Sadece kullanıcı "marketing" çerezlerine onay verdiğinde yüklenir.
 * index.html'deki statik pixel kodu kaldırıldı.
 */
import { useEffect } from "react";
import { getConsent } from "./CookieConsent";

// Pixel ID env'den (Vercel → VITE_META_PIXEL_ID). Koda GÖMÜLMEZ. Tanımsızsa Pixel
// yüklenmez (güvenli no-op) → Murat Meta Events Manager'dan alıp Vercel env'e girecek.
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

declare global {
  interface Window {
    fbq: ((...args: any[]) => void) & { callMethod?: (...args: any[]) => void; queue?: any[]; loaded?: boolean; version?: string; push?: any };
    _fbq: typeof window.fbq;
  }
}

function loadPixel() {
  if (!PIXEL_ID) {
    if (import.meta.env.DEV) console.warn("[MetaPixel] VITE_META_PIXEL_ID tanımsız — Pixel yüklenmedi.");
    return;
  }
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

/**
 * Lead event — demo-talep / iletişim formu BAŞARILI submit'inde çağrılır.
 * fbq yalnız marketing-onayı + geçerli Pixel ID varsa yüklüdür → trackLead
 * otomatik olarak consent-gated'dır (onay yoksa window.fbq yok → sessiz no-op).
 * Kullanım: import { trackLead } from "@/components/MetaPixel"; trackLead();
 * Yeni bir dönüşüm noktası eklenirse (ör. "Ücretsiz Dene" tıklaması) buraya
 * benzer bir helper (trackCompleteRegistration vb.) eklenip oraya bağlanabilir.
 */
export function trackLead(params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Lead", params);
  }
}

/**
 * ARAÇ-1 karne: araç sayfalarının üçlü ölçümü — görüntüleme / indirme / CTA.
 * VERİ İLKESİ: yalnız araç kimliği ve biçim (doc|pdf) gönderilir; kullanıcının
 * forma girdiği HİÇBİR alan değeri event'e KONMAZ (araç sayfası sunucusuz).
 * trackLead ile aynı consent-kapısı: onay yoksa window.fbq yok → sessiz no-op,
 * yani rakam eksik sayar (yön göstergesi, kesin sayaç değil).
 */
export function trackToolEvent(
  kind: "view" | "download" | "cta",
  params: { tool: string; format?: "doc" | "pdf"; target?: string },
) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    const name = kind === "view" ? "ToolView" : kind === "download" ? "ToolDocumentGenerated" : "ToolCtaClick";
    window.fbq("trackCustom", name, params);
  }
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
