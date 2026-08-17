import { lazy, Suspense, useEffect } from "react";
import { Outlet } from "react-router-dom";
import type { RouteRecord } from "vite-react-ssg";
import { CookieConsent } from "@/components/CookieConsent";
import { SEOHead } from "@/components/SEOHead";
import { MetaPixel } from "@/components/MetaPixel";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import "./i18n";

// HTML root'unda dir ve lang attribute'unu i18n diline göre günceller.
// Arapça seçilince dir="rtl" olur, tarayıcı RTL layout'a geçer. (client-only)
function RtlEffect() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const isRTL = i18n.language === "ar";
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language || "tr";
  }, [i18n.language]);
  return null;
}

// Eager loaded (kritik yol)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy loaded (code splitting)
const Admin           = lazy(() => import("./pages/Admin"));
const ResetPassword   = lazy(() => import("./pages/ResetPassword"));
const GettingStarted  = lazy(() => import("./pages/GettingStarted"));
const Help            = lazy(() => import("./pages/Help"));
const NotFound        = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy   = lazy(() => import("./pages/PrivacyPolicy"));
const DataDeletion    = lazy(() => import("./pages/DataDeletion"));
const DataExport      = lazy(() => import("./pages/DataExport"));
const TermsOfService  = lazy(() => import("./pages/TermsOfService"));

// SEO sayfaları
const WhatsAppChatbot     = lazy(() => import("./pages/WhatsAppChatbot"));
const AITurRezervasyonu   = lazy(() => import("./pages/AITurRezervasyonu"));
const CokDilliHizmet      = lazy(() => import("./pages/CokDilliHizmet"));
const TurOtomasyonu       = lazy(() => import("./pages/TurOtomasyonu"));
// SITE-MENU-1 FAZ-C (2026-08-14): /cozum/* ve /karsilastir/* sayfaları emekli edildi.
// incoming + günübirlik → zenginleştirilip bloga taşındı; butik → M1'e, karşılaştırma
// → mevcut blog yazısına 301'lendi (vercel.json, permanent: true).
const Blog                = lazy(() => import("./pages/Blog"));
const BlogPost            = lazy(() => import("./pages/BlogPost"));

// ARAÇ-1 — Araçlar bölümü (route'lar 3 dile hazır; pilot içerik TR)
const ToolsHub            = lazy(() => import("./pages/ToolsHub"));
const RehberSozlesmesi    = lazy(() => import("./pages/tools/RehberSozlesmesi"));
const TurKarHesaplayici    = lazy(() => import("./pages/tools/TurKarHesaplayici"));
const TurSatisSozlesmesi   = lazy(() => import("./pages/tools/TurSatisSozlesmesi"));
const TurTeklifi           = lazy(() => import("./pages/tools/TurTeklifi"));
const TransferSozlesmesi   = lazy(() => import("./pages/tools/TransferSozlesmesi"));

const queryClient = new QueryClient();

// Kök layout — tüm provider'lar + Suspense + Outlet. Eski App.tsx'in provider
// ağacı BİREBİR korunur; yalnız <BrowserRouter><Routes> yerine vite-react-ssg
// routes dizisi + <Outlet/>. HelmetProvider KALDIRILDI: head artık vite-react-ssg
// <Head> (SEOHead içinde) ile yönetilir → prerender'da ham HTML'e gömülür.
function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CookieConsent />
        <MetaPixel />
        <RtlEffect />
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export const routes: RouteRecord[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      // Core
      { index: true, element: <Index /> },
      { path: "auth",           element: <><SEOHead title="Giriş" noindex /><Auth /></> },
      { path: "admin",          element: <><SEOHead title="Panel" noindex /><Admin /></> },
      { path: "reset-password", element: <><SEOHead title="Şifre Sıfırlama" noindex /><ResetPassword /></> },
      { path: "nasil-baslarim", element: <><SEOHead title="Nasıl Başlarım? Kurulum Rehberi" description="Turzz AI'ı acenteniz için dakikalar içinde kurun: hesap, tur ekleme, WhatsApp bağlantısı — adım adım başlangıç rehberi." /><GettingStarted /></> },
      { path: "yardim",         element: <><SEOHead title="Yardım Merkezi ve SSS" description="Turzz AI yardım merkezi: sık sorulan sorular, kurulum, WhatsApp entegrasyonu ve rezervasyon yönetimi hakkında cevaplar." /><Help /></> },
      { path: "privacy-policy",   element: <><SEOHead title="Gizlilik Politikası" description="Turzz AI gizlilik politikası: kişisel verilerin işlenmesi, saklanması ve korunması hakkında bilgilendirme." /><PrivacyPolicy /></> },
      { path: "data-deletion",    element: <><SEOHead title="Veri Silme Talebi" description="Turzz AI veri silme talebi: hesap ve kişisel verilerinizin silinmesini bu sayfadan talep edebilirsiniz." /><DataDeletion /></> },
      { path: "data-export",      element: <><SEOHead title="Veri Dışa Aktarma" description="Turzz AI veri taşınabilirliği: hesabınıza ait verilerin kopyasını bu sayfadan talep edebilirsiniz." /><DataExport /></> },
      { path: "terms-of-service", element: <><SEOHead title="Kullanım Koşulları" description="Turzz AI hizmet kullanım koşulları ve abonelik şartları." /><TermsOfService /></> },

      // SEO — Özellikler
      { path: "whatsapp-chatbot-seyahat-acentesi", element: <WhatsAppChatbot /> },
      { path: "ai-tur-rezervasyonu",               element: <AITurRezervasyonu /> },
      { path: "cok-dilli-musteri-hizmetleri",      element: <CokDilliHizmet /> },
      { path: "tur-otomasyonu",                    element: <TurOtomasyonu /> },

      // ARAÇ-1 — Araçlar (hub + pilot). TR prefix'siz; EN/DE prefix'li (blog deseni).
      { path: "araclar",                                 element: <ToolsHub /> },
      { path: "araclar/rehber-sozlesmesi-olusturucu",    element: <RehberSozlesmesi /> },
      { path: "araclar/tur-kar-hesaplayici",             element: <TurKarHesaplayici /> },
      { path: "araclar/tur-satis-sozlesmesi-olusturucu", element: <TurSatisSozlesmesi /> },
      { path: "araclar/tur-teklifi-olusturucu",          element: <TurTeklifi /> },
      { path: "araclar/transfer-sozlesmesi-olusturucu",  element: <TransferSozlesmesi /> },
      { path: "en/tools",                                element: <ToolsHub /> },
      { path: "en/tools/guide-contract-generator",       element: <RehberSozlesmesi /> },
      { path: "en/tools/tour-profit-calculator",         element: <TurKarHesaplayici /> },
      { path: "en/tools/tour-sales-contract-generator",  element: <TurSatisSozlesmesi /> },
      { path: "en/tools/tour-quote-generator",           element: <TurTeklifi /> },
      { path: "en/tools/transport-contract-generator",   element: <TransferSozlesmesi /> },
      { path: "de/tools",                                element: <ToolsHub /> },
      { path: "de/tools/reiseleiter-vertrag-generator",  element: <RehberSozlesmesi /> },
      { path: "de/tools/tour-gewinn-rechner",            element: <TurKarHesaplayici /> },
      { path: "de/tools/reisevertrag-generator",         element: <TurSatisSozlesmesi /> },
      { path: "de/tools/tour-angebot-generator",         element: <TurTeklifi /> },
      { path: "de/tools/transportvertrag-generator",     element: <TransferSozlesmesi /> },

      // Blog — Türkçe (prefix yok, default)
      { path: "blog",       element: <Blog /> },
      { path: "blog/:slug", element: <BlogPost /> },

      // Blog — Dil-prefix'li rotalar (EN/DE/RU/AR/FR/ES)
      { path: "en/blog",       element: <Blog /> },
      { path: "en/blog/:slug", element: <BlogPost /> },
      { path: "de/blog",       element: <Blog /> },
      { path: "de/blog/:slug", element: <BlogPost /> },
      { path: "ru/blog",       element: <Blog /> },
      { path: "ru/blog/:slug", element: <BlogPost /> },
      { path: "ar/blog",       element: <Blog /> },
      { path: "ar/blog/:slug", element: <BlogPost /> },
      { path: "fr/blog",       element: <Blog /> },
      { path: "fr/blog/:slug", element: <BlogPost /> },
      { path: "es/blog",       element: <Blog /> },
      { path: "es/blog/:slug", element: <BlogPost /> },

      // 404 — noindex (soft-404 index kirliliğini önler)
      { path: "*", element: <><SEOHead title="Sayfa Bulunamadı" noindex /><NotFound /></> },
    ],
  },
];
