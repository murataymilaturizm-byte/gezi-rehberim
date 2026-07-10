import { lazy, Suspense, useEffect } from "react";
import { CookieConsent } from "@/components/CookieConsent";
import { SEOHead } from "@/components/SEOHead";
import { MetaPixel } from "@/components/MetaPixel";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./i18n";

// HTML root'unda dir ve lang attribute'unu i18n diline göre günceller.
// Arapça seçilince dir="rtl" olur, tarayıcı RTL layout'a geçer.
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
const IncomingAcenteler   = lazy(() => import("./pages/cozum/IncomingAcenteler"));
const GunubirlikTur       = lazy(() => import("./pages/cozum/GunubirlikTur"));
const ButikAcenteler      = lazy(() => import("./pages/cozum/ButikAcenteler"));
const TurzzVsManuel       = lazy(() => import("./pages/karsilastir/TurzzVsManuel"));
const Blog                = lazy(() => import("./pages/Blog"));
const BlogPost            = lazy(() => import("./pages/BlogPost"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CookieConsent />
      <MetaPixel />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RtlEffect />
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            {/* Core.
                SEO-FIX (2026-07-10): SEOHead kullanmayan sayfalar ROUTE-
                seviyesinde sarmalandı — canonical artık HER sayfada kendi
                pathname'i (SEOHead default). Uygulama-içi sayfalar (auth/
                admin/reset) noindex; içerik sayfaları title+desc alır. */}
            <Route path="/"            element={<Index />} />
            <Route path="/auth"        element={<><SEOHead title="Giriş" noindex /><Auth /></>} />
            <Route path="/admin"       element={<><SEOHead title="Panel" noindex /><Admin /></>} />
            <Route path="/reset-password" element={<><SEOHead title="Şifre Sıfırlama" noindex /><ResetPassword /></>} />
            <Route path="/nasil-baslarim" element={<><SEOHead title="Nasıl Başlarım? Kurulum Rehberi" description="Turzz AI'ı acenteniz için dakikalar içinde kurun: hesap, tur ekleme, WhatsApp bağlantısı — adım adım başlangıç rehberi." /><GettingStarted /></>} />
            <Route path="/yardim"      element={<><SEOHead title="Yardım Merkezi ve SSS" description="Turzz AI yardım merkezi: sık sorulan sorular, kurulum, WhatsApp entegrasyonu ve rezervasyon yönetimi hakkında cevaplar." /><Help /></>} />
            <Route path="/privacy-policy"   element={<><SEOHead title="Gizlilik Politikası" description="Turzz AI gizlilik politikası: kişisel verilerin işlenmesi, saklanması ve korunması hakkında bilgilendirme." /><PrivacyPolicy /></>} />
            <Route path="/data-deletion"    element={<><SEOHead title="Veri Silme Talebi" description="Turzz AI veri silme talebi: hesap ve kişisel verilerinizin silinmesini bu sayfadan talep edebilirsiniz." /><DataDeletion /></>} />
            <Route path="/data-export"      element={<><SEOHead title="Veri Dışa Aktarma" description="Turzz AI veri taşınabilirliği: hesabınıza ait verilerin kopyasını bu sayfadan talep edebilirsiniz." /><DataExport /></>} />
            <Route path="/terms-of-service" element={<><SEOHead title="Kullanım Koşulları" description="Turzz AI hizmet kullanım koşulları ve abonelik şartları." /><TermsOfService /></>} />

            {/* SEO — Özellikler */}
            <Route path="/whatsapp-chatbot-seyahat-acentesi" element={<WhatsAppChatbot />} />
            <Route path="/ai-tur-rezervasyonu"               element={<AITurRezervasyonu />} />
            <Route path="/cok-dilli-musteri-hizmetleri"      element={<CokDilliHizmet />} />
            <Route path="/tur-otomasyonu"                    element={<TurOtomasyonu />} />

            {/* SEO — Çözümler */}
            <Route path="/cozum/incoming-acenteler" element={<IncomingAcenteler />} />
            <Route path="/cozum/gunubirlik-tur"     element={<GunubirlikTur />} />
            <Route path="/cozum/butik-acenteler"    element={<ButikAcenteler />} />

            {/* SEO — Karşılaştırma */}
            <Route path="/karsilastir/turzz-vs-manuel-whatsapp" element={<TurzzVsManuel />} />

            {/* Blog — Türkçe (prefix yok, default) */}
            <Route path="/blog"       element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />

            {/* Blog — Dil-prefix'li rotalar (EN/DE/RU/AR/FR/ES) */}
            <Route path="/en/blog"       element={<Blog />} />
            <Route path="/en/blog/:slug" element={<BlogPost />} />
            <Route path="/de/blog"       element={<Blog />} />
            <Route path="/de/blog/:slug" element={<BlogPost />} />
            <Route path="/ru/blog"       element={<Blog />} />
            <Route path="/ru/blog/:slug" element={<BlogPost />} />
            <Route path="/ar/blog"       element={<Blog />} />
            <Route path="/ar/blog/:slug" element={<BlogPost />} />
            <Route path="/fr/blog"       element={<Blog />} />
            <Route path="/fr/blog/:slug" element={<BlogPost />} />
            <Route path="/es/blog"       element={<Blog />} />
            <Route path="/es/blog/:slug" element={<BlogPost />} />

            {/* 404 — noindex (soft-404 index kirliliğini önler) */}
            <Route path="*" element={<><SEOHead title="Sayfa Bulunamadı" noindex /><NotFound /></>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
