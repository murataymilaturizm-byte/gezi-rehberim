import "./ssr-polyfill"; // İLK: prerender'da localStorage shim'i (routes/i18n/supabase'den ÖNCE)
import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./routes";
import "./index.css";

// SEO-FIX (2026-07-25 SSG): SPA → build-time prerender (vite-react-ssg).
// Pazarlama + blog rotaları statik HTML'e üretilir (curl/AI-crawler ham içerik
// görür); panel rotaları (/admin, /auth, /reset-password) prerender-DIŞI kalır
// (vite.config includedRoutes) → istemcide SPA olarak hidrasyonla açılır.
// Head yönetimi SEOHead içindeki vite-react-ssg <Head> ile → canonical/og/schema
// prerender çıktısına gömülür. HelmetProvider artık gerekmez (vite-react-ssg
// kendi head context'ini sağlar).
export const createRoot = ViteReactSSG({ routes });
