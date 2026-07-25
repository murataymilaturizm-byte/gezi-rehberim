import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "node:fs";
import { componentTagger } from "lovable-tagger";

// SEO-FIX (2026-07-25 SSG): prerender edilecek rota listesi = sitemap.xml (112 URL).
// prebuild (generate-sitemap) build'den ÖNCE koşar → sitemap taze. Host'u strip edip
// path'e çeviririz. Böylece prerender-seti ile sitemap-seti BİREBİR aynı olur (tek-
// kaynak). Panel rotaları (/admin, /auth, /reset-password) sitemap'te YOK → doğal
// olarak prerender-dışı (SPA kalır). Sitemap okunamazsa auto-path fallback + panel filtre.
const PANEL_EXCLUDE = new Set(["/auth", "/admin", "/reset-password"]);
function includedRoutesFromSitemap(paths: string[]): string[] {
  try {
    const xml = fs.readFileSync(path.resolve(__dirname, "public/sitemap.xml"), "utf-8");
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
    const out = locs
      .map((u) => u.replace(/^https?:\/\/[^/]+/, ""))
      .map((p) => (p === "" ? "/" : p));
    return Array.from(new Set(out));
  } catch {
    // Fallback: vite-react-ssg'nin türettiği statik path'ler eksi panel/dinamik.
    return paths.filter(
      (p) => !PANEL_EXCLUDE.has(p) && !p.includes(":") && !p.includes("*"),
    );
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // vite-react-ssg prerender ayarları (runtime'da vite-react-ssg okur)
  ssgOptions: {
    script: "async",
    // Kritik-CSS inline (beasties) KAPALI: Tailwind/shadcn ile yanlış-strip / FOUC
    // riskini önler; CSS normal bundle olarak yüklenir (pazarlama sayfası için yeterli).
    crittersOptions: false,
    includedRoutes: (paths: string[]) => includedRoutesFromSitemap(paths),
  },
}));
