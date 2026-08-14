import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/SiteHeader";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// src/legal/privacy/*.md — ?raw + EAGER: prerender-fix (2026-07-26). Eskiden eager:false
// + useEffect async yükleniyordu → prerender'da içerik BOŞTU (loading state), ham HTML'de
// gizlilik metni GÖRÜNMÜYORDU (SEO/GEO eksik). Şimdi eager → bundle'da senkron, prerender'a
// TR metni gömülür; istemcide i18n dili değişince re-render ile ilgili dil basılır. (blog.ts deseni.)
const policyFiles = import.meta.glob("../legal/privacy/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const BACK_LABELS: Record<string, string> = {
  tr: "Geri", en: "Back", de: "Zurück",
  ru: "Назад", ar: "رجوع", fr: "Retour", es: "Volver",
};

const PrivacyPolicy = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language?.slice(0, 2) || "tr";

  // Senkron seçim (eager glob) → prerender'da içerik hazır. Dil yoksa TR fallback.
  const key =
    Object.keys(policyFiles).find((k) => k.endsWith(`/${lang}.md`)) ??
    Object.keys(policyFiles).find((k) => k.endsWith("/tr.md"));
  const content = key ? policyFiles[key] : "";

  const backLabel = BACK_LABELS[lang] ?? "Back";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />
          {backLabel}
        </Button>

        <article className="prose prose-sm sm:prose lg:prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-primary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
