import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// src/legal/terms/*.md dosyaları — ?raw ile ham metin olarak import
const termsFiles = import.meta.glob("../legal/terms/*.md", {
  query: "?raw",
  import: "default",
  eager: false,
}) as Record<string, () => Promise<string>>;

const BACK_LABELS: Record<string, string> = {
  tr: "Geri", en: "Back", de: "Zurück",
  ru: "Назад", ar: "رجوع", fr: "Retour", es: "Volver",
};

const TermsOfService = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const lang = i18n.language?.slice(0, 2) || "tr";
    const key = Object.keys(termsFiles).find((k) => k.endsWith(`/${lang}.md`));
    const fallback = Object.keys(termsFiles).find((k) => k.endsWith("/tr.md"));
    const loader = termsFiles[key ?? fallback ?? ""];

    if (loader) {
      loader().then((text) => {
        setContent(text);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [i18n.language]);

  const backLabel = BACK_LABELS[i18n.language?.slice(0, 2)] ?? "Back";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />
          {backLabel}
        </Button>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        ) : (
          <article className="prose prose-sm sm:prose lg:prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  );
};

export default TermsOfService;
