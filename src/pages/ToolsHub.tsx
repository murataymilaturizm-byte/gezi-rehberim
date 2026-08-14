import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, FileText, ShieldCheck, BookOpen } from "lucide-react";
import { toolsForLang, TOOLS_HUB_PATH, type ToolLang } from "@/lib/tools/registry";

// ARAÇ-1 / Araçlar hub'ı.
// "Yakında" kartı YOK — yalnız yayında olan araçlar listelenir (boş vaat vitrini olmaz).
// Tek araçlı dönemde grid boş görünmesin diye yanına GERÇEK bir kaynak kartı
// (ilgili blog rehberi) konur: hem doğal iç-link hem dürüst vitrin.

const SUPPORTED = ["tr", "en", "de"] as const;

function langFromPath(pathname: string): ToolLang {
  const m = pathname.match(/^\/([a-z]{2})\//);
  const l = m?.[1];
  return (SUPPORTED as readonly string[]).includes(l ?? "") ? (l as ToolLang) : "tr";
}

const COPY: Record<ToolLang, {
  h1: string; intro: string; why: string; whyBody: string;
  privacy: string; guideCardTitle: string; guideCardDesc: string; guideCardHref: string; open: string;
}> = {
  tr: {
    h1: "Acenteler İçin Ücretsiz Araçlar",
    intro: "Seyahat acentelerinin günlük işinde tekrar eden belge ve hesap işlerini kolaylaştıran araçlar. Kayıt gerekmez, ücretsizdir ve girdiğiniz bilgiler cihazınızdan çıkmaz.",
    why: "Bu araçlar neden ücretsiz?",
    whyBody: "Turzz AI, acentelerin rezervasyon ve müşteri iletişimini otomatikleştiren bir sistem. Bu araçlar o işin küçük ama gerçek bir parçasını çözüyor; faydalı bulursanız asıl sistemi de merak edersiniz diye düşünüyoruz. Kullanmak için hesap açmanız gerekmiyor.",
    privacy: "Girdiğiniz bilgiler sunucumuza gönderilmez, kaydedilmez — belgeler tamamen tarayıcınızda oluşturulur.",
    guideCardTitle: "Tur İptal ve İade Politikası Nasıl Yazılır?",
    guideCardDesc: "Müşteri tarafındaki metinler için şablonlu rehber: iade merdiveni, force-majeure ilkeleri ve doldurulabilir politika iskeleti.",
    guideCardHref: "/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir",
    open: "Aracı aç",
  },
  en: {
    h1: "Free Tools for Travel Agencies",
    intro: "Tools that simplify the repetitive document and calculation work in a travel agency's daily routine. No sign-up, free, and your data never leaves your device.",
    why: "Why are these tools free?",
    whyBody: "Turzz AI automates booking and customer communication for agencies. These tools solve a small but real part of that work; if you find them useful, we hope you'll be curious about the system itself. No account needed.",
    privacy: "The information you enter is never sent to our servers or stored — documents are generated entirely in your browser.",
    guideCardTitle: "How to Write a Tour Cancellation & Refund Policy",
    guideCardDesc: "A template-backed guide for customer-facing terms: the refund ladder, force-majeure principles and a fillable policy skeleton.",
    guideCardHref: "/en/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir",
    open: "Open tool",
  },
  de: {
    h1: "Kostenlose Werkzeuge für Reisebüros",
    intro: "Werkzeuge, die wiederkehrende Dokumenten- und Rechenarbeit im Alltag eines Reisebüros vereinfachen. Ohne Registrierung, kostenlos — Ihre Daten verlassen Ihr Gerät nicht.",
    why: "Warum sind diese Werkzeuge kostenlos?",
    whyBody: "Turzz AI automatisiert Buchung und Kundenkommunikation für Agenturen. Diese Werkzeuge lösen einen kleinen, aber realen Teil dieser Arbeit; wenn sie nützlich sind, werden Sie vielleicht auch auf das System selbst neugierig. Kein Konto nötig.",
    privacy: "Ihre Eingaben werden nicht an unsere Server gesendet oder gespeichert — Dokumente entstehen vollständig in Ihrem Browser.",
    guideCardTitle: "Storno- und Erstattungsrichtlinie für Touren schreiben",
    guideCardDesc: "Ein Leitfaden mit Vorlage für kundenseitige Bedingungen: Erstattungsleiter, Force-Majeure-Prinzipien und ausfüllbares Gerüst.",
    guideCardHref: "/de/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir",
    open: "Werkzeug öffnen",
  },
};

export default function ToolsHub() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const lang = langFromPath(location.pathname);
  const c = COPY[lang];
  const tools = toolsForLang(lang);
  // Pilot TR-only: EN/DE hub'ında araç listesi boşsa TR aracına yönlendiren not gösterilir.
  const trTools = toolsForLang("tr");

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": c.h1,
    "description": c.intro,
    "url": `https://turzzai.com${TOOLS_HUB_PATH[lang]}`,
  };

  return (
    <Layout>
      <SEOHead
        title={c.h1}
        description={c.intro}
        keywords="acente araçları, rehber sözleşmesi, tur sözleşmesi şablonu, ücretsiz acente aracı"
        canonical={TOOLS_HUB_PATH[lang]}
        schema={schema}
      />

      <section className="py-12 bg-gradient-to-b from-orange-50/30 to-background dark:from-orange-950/10">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{c.h1}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">{c.intro}</p>
          <p className="mt-4 inline-flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2 text-left">
            <ShieldCheck className="w-4 h-4 mt-0.5 text-orange-500 shrink-0" aria-hidden="true" />
            <span>{c.privacy}</span>
          </p>
        </div>
      </section>

      <section className="py-10 container mx-auto px-4 max-w-4xl">
        <div className="grid md:grid-cols-2 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              to={tool.path[lang]}
              aria-label={tool.title[lang]}
              className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg"
            >
              <Card className="h-full border-border/50 transition-all duration-200 group-hover:border-orange-300 group-hover:shadow-lg group-hover:-translate-y-1 group-active:scale-[0.99]">
                <CardContent className="p-6 flex flex-col h-full">
                  <FileText className="w-8 h-8 text-orange-500 mb-3" aria-hidden="true" />
                  <h2 className="font-semibold text-lg text-foreground mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {tool.title[lang]}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{tool.description[lang]}</p>
                  <span className="text-sm font-medium text-orange-500 inline-flex items-center gap-1">
                    {c.open}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Tek-araç döneminde vitrini GERÇEK içerikle tamamla (yakında-kartı yok) */}
          <Link
            to={c.guideCardHref}
            aria-label={c.guideCardTitle}
            className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg"
          >
            <Card className="h-full border-border/50 border-dashed transition-all duration-200 group-hover:border-orange-300 group-hover:shadow-md group-active:scale-[0.99]">
              <CardContent className="p-6 flex flex-col h-full">
                <BookOpen className="w-8 h-8 text-muted-foreground mb-3" aria-hidden="true" />
                <h2 className="font-semibold text-lg text-foreground mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {c.guideCardTitle}
                </h2>
                <p className="text-sm text-muted-foreground flex-1">{c.guideCardDesc}</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {tools.length === 0 && trTools.length > 0 && (
          <p className="mt-8 text-sm text-muted-foreground text-center">
            The first tool is currently available in Turkish —{" "}
            <Link to={trTools[0].path.tr} className="text-orange-500 hover:underline">
              {trTools[0].title.tr}
            </Link>
          </p>
        )}

        <div className="mt-10 rounded-xl bg-muted/40 px-5 py-5">
          <h2 className="font-semibold text-foreground mb-2">{c.why}</h2>
          <p className="text-sm text-muted-foreground">{c.whyBody}</p>
        </div>
      </section>
    </Layout>
  );
}
