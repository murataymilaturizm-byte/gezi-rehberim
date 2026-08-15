import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Printer, ShieldCheck, Link2, AlertCircle, Plus, X, Check } from "lucide-react";
import { extractFaq, buildFaqSchema, ctaTexts, DEMO_WA_URL, SIGNUP_URL } from "@/lib/blog-anatomy";
import { trackToolEvent } from "@/components/MetaPixel";
import { TOOLS } from "@/lib/tools/registry";
import { ARTICLE_MD } from "@/lib/tools/tur-kar-hesaplayici/article";
import {
  DEFAULT_INPUT, FIXED_FIELDS, VARIABLE_FIELDS, PLANNING_OPTIONS, CURRENCY_SYMBOL,
  newLine, type CalcInput, type CostLine, type Currency,
} from "@/lib/tools/tur-kar-hesaplayici/schema";
import { calculate, money, num, WARNING_TEXT } from "@/lib/tools/tur-kar-hesaplayici/calc";
import { buildShareUrl, readStateFromUrl } from "@/lib/tools/tur-kar-hesaplayici/share";

// ARAÇ-2 / Tur Kâr-Fiyat Hesaplayıcı.
// PRERENDER: iskelet (H1, açıklama, kardeş-makale, SSS, CTA) statik HTML'e girer;
// hesap arayüzü YALNIZ client-mount sonrası render edilir (mounted guard).
// CLS=0: form ve sonuç panelinin yer tutucuları prerender'da da aynı yüksekliği
// kaplar → hydration sırasında düzen kaymaz.
// Kütüphane YOK: hesap saf JS (calc.ts), "sonucu indir" tarayıcı yazdırması.

const TOOL = TOOLS.find((t) => t.id === "tur-kar-hesaplayici")!;
const PAGE_TITLE = "Tur Kâr ve Fiyat Hesaplayıcı — Doluluk Senaryolu Ücretsiz Araç";
const PAGE_DESC =
  "Sabit ve kişi-başı giderlerinizi girin; kişi başı maliyeti, önerilen satış fiyatını, başabaş noktasını ve %50-%100 doluluk senaryolarında kârı görün. Kayıt yok, rakamlarınız cihazınızdan çıkmaz.";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide border-b border-border pb-2 mb-4 mt-8 first:mt-0">
      {children}
    </h3>
  );
}

function MoneyField({
  label, value, onChange, hint, suffix,
}: { label: string; value: string; onChange: (v: string) => void; hint?: string; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        <Input
          type="text" inputMode="decimal" value={value} placeholder="0"
          onChange={(e) => onChange(e.target.value)}
          className={suffix ? "pe-10" : undefined}
        />
        {suffix && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Serbest gider satırları (+satır ekle) */
function LineEditor({
  lines, onChange, addLabel, sym,
}: { lines: CostLine[]; onChange: (l: CostLine[]) => void; addLabel: string; sym: string }) {
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={l.id} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              value={l.label} placeholder="Kalem adı"
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...l, label: e.target.value };
                onChange(next);
              }}
            />
          </div>
          <div className="w-32 relative">
            <Input
              type="text" inputMode="decimal" value={l.amount} placeholder="0" className="pe-8"
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...l, amount: e.target.value };
                onChange(next);
              }}
            />
            <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{sym}</span>
          </div>
          <Button
            type="button" variant="ghost" size="icon" aria-label="Satırı sil"
            onClick={() => onChange(lines.filter((x) => x.id !== l.id))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, newLine()])}>
        <Plus className="h-3.5 w-3.5 me-1.5" /> {addLabel}
      </Button>
    </div>
  );
}

/** Sonuç paneli — canlı, ARAÇ-1 önizleme deseni. Yazdırılan DOM budur. */
function ResultPanel({ input }: { input: CalcInput }) {
  const r = calculate(input);
  const sym = CURRENCY_SYMBOL[input.paraBirimi];

  if (!r.valid) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground min-h-[420px] flex items-center justify-center">
        <span>
          Sonuçları görmek için <strong className="text-foreground">kapasite</strong> ve
          en az bir gider kalemi girin.
        </span>
      </div>
    );
  }

  return (
    <div id="hesap-sonucu" className="print-area bg-white text-black rounded-lg border border-border p-5 md:p-7 text-[13px] leading-relaxed">
      <h2 className="text-center font-bold text-base mb-1">Tur Kâr ve Fiyat Analizi</h2>
      <p className="text-center italic text-[11px] text-neutral-600 mb-5">
        Bilgilendirme amaçlıdır; mali müşavirlik yerine geçmez.
      </p>

      {/* Maliyet özeti */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded border border-neutral-200 p-3">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wide">Sabit gider (tur başına)</div>
          <div className="font-semibold text-[15px]">{money(r.F, sym)}</div>
        </div>
        <div className="rounded border border-neutral-200 p-3">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wide">Kişi başı değişken</div>
          <div className="font-semibold text-[15px]">{money(r.v, sym)}</div>
        </div>
      </div>

      {/* Fiyatlama satırı — TEK önerilen fiyat */}
      {input.priceMode === "oner" ? (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4 mb-5">
          <div className="text-[11px] text-neutral-600 uppercase tracking-wide mb-1">
            Önerilen satış fiyatı — %{Math.round(input.planlamaDoluluk * 100)} planlama doluluğu ({r.nPlan} kişi)
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-2xl font-bold">{money(r.pYuvarlak, sym)}</span>
            <span className="text-[12px] text-neutral-600">
              (ham: {money(r.pListe, sym)} · KDV dahil: {money(r.pKdvli, sym)})
            </span>
          </div>
          <div className="text-[11px] text-neutral-600 mt-2">
            Kişi başı maliyet {money(r.cPlan, sym)} ·{" "}
            {input.karModu === "markup"
              ? `maliyet × (1 + %${num(input.karOrani)})`
              : `maliyet ÷ (1 − %${num(input.karOrani)})`}
            {num(input.komisyon) > 0 ? ` · komisyon %${num(input.komisyon)} eklendi` : ""}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-sky-300 bg-sky-50 p-4 mb-5">
          <div className="text-[11px] text-neutral-600 uppercase tracking-wide mb-1">Test edilen fiyat (KDV hariç)</div>
          <div className="text-2xl font-bold">{money(r.effectivePrice, sym)}</div>
          <div className="text-[11px] text-neutral-600 mt-1">
            KDV dahil: {money(r.effectivePrice * (1 + num(input.kdv) / 100), sym)}
          </div>
        </div>
      )}

      {/* Başabaş */}
      <div className="mb-5">
        <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1">Başabaş noktası</div>
        {r.breakeven.possible ? (
          <p>
            Maliyeti kurtarma noktası:{" "}
            <strong>{r.breakeven.n} kişi</strong>{" "}
            <span className="text-neutral-600">
              ({r.kapasite} koltuğun %{Math.round(((r.breakeven.n || 0) / r.kapasite) * 100)}'i · kişi başı katkı {money(r.breakeven.birimKatki, sym)})
            </span>
          </p>
        ) : (
          <p className="text-neutral-700">
            Bu fiyatla başabaş noktası yok — kişi başı katkı sıfır veya negatif.
          </p>
        )}
      </div>

      {/* Uyarı — üç seviye */}
      {r.warning !== "none" && (
        <div className={`rounded-md px-3 py-2 mb-5 text-[12px] border ${
          r.warning === "riskli"
            ? "bg-amber-50 border-amber-300 text-amber-900"
            : "bg-red-50 border-red-300 text-red-900"
        }`}>
          {WARNING_TEXT[r.warning]}
        </div>
      )}

      {/* Doluluk senaryoları */}
      <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-2">
        Doluluk senaryoları — ilan fiyatı {money(r.effectivePrice, sym)} sabit
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-neutral-100">
              <th className="text-start p-2 border border-neutral-200">Doluluk</th>
              <th className="text-end p-2 border border-neutral-200">Kişi</th>
              <th className="text-end p-2 border border-neutral-200">Kişi başı maliyet</th>
              <th className="text-end p-2 border border-neutral-200">Gelir</th>
              <th className="text-end p-2 border border-neutral-200">Maliyet</th>
              <th className="text-end p-2 border border-neutral-200">Kâr</th>
            </tr>
          </thead>
          <tbody>
            {r.scenarios.map((s) => (
              <tr key={s.doluluk}>
                <td className="p-2 border border-neutral-200">%{Math.round(s.doluluk * 100)}</td>
                <td className="p-2 border border-neutral-200 text-end tabular-nums">{s.n}</td>
                <td className="p-2 border border-neutral-200 text-end tabular-nums">{money(s.kisiBasiMaliyet, sym)}</td>
                <td className="p-2 border border-neutral-200 text-end tabular-nums">{money(s.gelir, sym)}</td>
                <td className="p-2 border border-neutral-200 text-end tabular-nums">{money(s.maliyet, sym)}</td>
                <td className={`p-2 border border-neutral-200 text-end tabular-nums font-semibold ${s.kar < 0 ? "text-red-700" : ""}`}>
                  {money(s.kar, sym)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-neutral-500 mt-4 leading-snug">
        Maliyetler KDV hariç girilmelidir; KDV indirim mekanizması bu araçta modellenmez —
        mali müşavirinize danışın. Para birimi yalnız etikettir, kur dönüşümü yapılmaz.
        Hesaplar turzzai.com/araclar üzerinde tarayıcınızda yapılmıştır.
      </p>
    </div>
  );
}

export default function TurKarHesaplayici() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"form" | "sonuc">("form");
  const [input, setInput] = useState<CalcInput>(DEFAULT_INPUT);
  const [copied, setCopied] = useState(false);
  const calcFired = useRef(false);

  const faq = useMemo(() => extractFaq(ARTICLE_MD), []);
  const faqSchema = useMemo(() => buildFaqSchema(faq), [faq]);
  const cta = ctaTexts("tr");
  const sym = CURRENCY_SYMBOL[input.paraBirimi];

  // Client-mount + paylaşılan link varsa oku
  useEffect(() => {
    setMounted(true);
    const shared = readStateFromUrl();
    if (shared) setInput(shared);
    trackToolEvent("view", { tool: TOOL.id });
  }, []);

  // "hesaplama-yapıldı" — sonuç panelinin İLK anlamlı dolumu (oturumda bir kez)
  const result = calculate(input);
  useEffect(() => {
    if (result.valid && !calcFired.current) {
      calcFired.current = true;
      trackToolEvent("calc", { tool: TOOL.id });
    }
  }, [result.valid]);

  const set = <K extends keyof CalcInput>(key: K, value: CalcInput[K]) =>
    setInput((p) => ({ ...p, [key]: value }));

  const handlePrint = () => {
    trackToolEvent("download", { tool: TOOL.id, format: "pdf" });
    if (typeof window !== "undefined") window.print();
  };

  const handleShare = async () => {
    const url = buildShareUrl(input);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Linki kopyalayın:", url);
    }
  };

  return (
    <Layout>
      <SEOHead title={PAGE_TITLE} description={PAGE_DESC} canonical={TOOL.path.tr} schema={faqSchema} />

      {/* Başlık — prerender'da statik */}
      <section className="py-10 bg-gradient-to-b from-orange-50/30 to-background dark:from-orange-950/10 no-print">
        <div className="container mx-auto px-4 max-w-6xl">
          <nav className="text-xs text-muted-foreground mb-3">
            <Link to="/araclar" className="hover:text-primary">Araçlar</Link>
            <span className="mx-1.5">/</span>
            <span>Tur Kâr ve Fiyat Hesaplayıcı</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-bold mb-3 flex items-start gap-2.5">
            <Calculator className="h-7 w-7 text-orange-500 shrink-0 mt-0.5" />
            Tur Kâr ve Fiyat Hesaplayıcı
          </h1>
          <p className="text-muted-foreground max-w-3xl">{PAGE_DESC}</p>
          <p className="mt-3 inline-flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-px" />
            Girdiğiniz rakamlar sunucumuza gönderilmez; hesap tamamen tarayıcınızda yapılır.
          </p>
        </div>
      </section>

      {/* Hesap alanı — client-mount */}
      <section className="container mx-auto px-4 max-w-6xl py-8">
        {!mounted ? (
          <div className="min-h-[560px] rounded-xl border border-border bg-muted/20 flex items-center justify-center no-print">
            <span className="text-sm text-muted-foreground">Hesaplayıcı yükleniyor…</span>
          </div>
        ) : (
          <>
            {/* Mobil sekme — desktop'ta iki kolon */}
            <div className="lg:hidden grid grid-cols-2 gap-2 mb-5 no-print">
              <Button variant={tab === "form" ? "default" : "outline"} size="sm" onClick={() => setTab("form")}>
                Giderler
              </Button>
              <Button variant={tab === "sonuc" ? "default" : "outline"} size="sm" onClick={() => setTab("sonuc")}>
                Sonuç
              </Button>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* ── FORM ── */}
              <div className={`${tab === "form" ? "block" : "hidden"} lg:block no-print`}>
                <SectionTitle>Sabit giderler (tur başına)</SectionTitle>
                <p className="text-xs text-muted-foreground -mt-2 mb-4">
                  Kişi sayısından bağımsız kalemler. Araçta 12 kişi de olsa 40 kişi de olsa değişmez.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {FIXED_FIELDS.map((f) => (
                    <MoneyField
                      key={f.key} label={f.label} suffix={sym}
                      value={input[f.key] as string}
                      onChange={(v) => set(f.key as keyof CalcInput, v as never)}
                    />
                  ))}
                </div>
                <div className="mt-4">
                  <LineEditor
                    lines={input.digerSabit} sym={sym} addLabel="Sabit gider satırı ekle"
                    onChange={(l) => set("digerSabit", l)}
                  />
                </div>

                <SectionTitle>Kişi başı değişken giderler</SectionTitle>
                <p className="text-xs text-muted-foreground -mt-2 mb-4">
                  Her yolcuyla birlikte artan kalemler. Çarpanları siz yapmayın — adet ve tutarı ayrı girin.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <MoneyField label="Müze / ören yeri girişleri" suffix={sym} value={input.muze} onChange={(v) => set("muze", v)} />
                  <MoneyField label="Sigorta" suffix={sym} value={input.sigorta} onChange={(v) => set("sigorta", v)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <MoneyField label="Yemek — öğün sayısı" value={input.yemekOgun} onChange={(v) => set("yemekOgun", v)} />
                  <MoneyField label="Yemek — öğün başı tutar" suffix={sym} value={input.yemekTutar} onChange={(v) => set("yemekTutar", v)} />
                  <MoneyField label="Konaklama — gece sayısı" value={input.konaklamaGece} onChange={(v) => set("konaklamaGece", v)} />
                  <MoneyField label="Konaklama — gece başı tutar" suffix={sym} value={input.konaklamaTutar} onChange={(v) => set("konaklamaTutar", v)} />
                </div>
                <div className="mt-4">
                  <LineEditor
                    lines={input.digerDegisken} sym={sym} addLabel="Değişken gider satırı ekle"
                    onChange={(l) => set("digerDegisken", l)}
                  />
                </div>

                <SectionTitle>Parametreler</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <MoneyField label="Kapasite (koltuk sayısı)" value={input.kapasite} onChange={(v) => set("kapasite", v)} />
                  <div className="space-y-1.5">
                    <Label className="text-sm">Planlama doluluğu</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={input.planlamaDoluluk}
                      onChange={(e) => set("planlamaDoluluk", parseFloat(e.target.value))}
                    >
                      {PLANNING_OPTIONS.map((p) => (
                        <option key={p} value={p}>%{Math.round(p * 100)}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">Önerilen fiyat bu doluluğa göre hesaplanır.</p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <Label className="text-sm">Kâr yöntemi</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button" size="sm"
                      variant={input.karModu === "markup" ? "default" : "outline"}
                      onClick={() => set("karModu", "markup")}
                    >
                      Maliyet üzerine kâr
                    </Button>
                    <Button
                      type="button" size="sm"
                      variant={input.karModu === "marj" ? "default" : "outline"}
                      onClick={() => set("karModu", "marj")}
                    >
                      Satıştan kâr payı
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {input.karModu === "markup"
                      ? "Fiyat = maliyet × (1 + oran). 100 ₺ maliyet, %30 → 130 ₺."
                      : "Fiyat = maliyet ÷ (1 − oran). 100 ₺ maliyet, %30 → 142,86 ₺."}
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mt-4">
                  <MoneyField label="Kâr oranı" suffix="%" value={input.karOrani} onChange={(v) => set("karOrani", v)} />
                  <MoneyField label="Satış komisyonu" suffix="%" value={input.komisyon} onChange={(v) => set("komisyon", v)} hint="Boşsa hesaba girmez" />
                  <MoneyField label="KDV oranı" suffix="%" value={input.kdv} onChange={(v) => set("kdv", v)} />
                </div>

                <div className="space-y-1.5 mt-4">
                  <Label className="text-sm">Para birimi</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["TRY", "EUR", "USD"] as Currency[]).map((c) => (
                      <Button
                        key={c} type="button" size="sm"
                        variant={input.paraBirimi === c ? "default" : "outline"}
                        onClick={() => set("paraBirimi", c)}
                      >
                        {c} {CURRENCY_SYMBOL[c]}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Yalnız etiket — kur dönüşümü yapılmaz.</p>
                </div>

                <SectionTitle>Mod</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button" size="sm"
                    variant={input.priceMode === "oner" ? "default" : "outline"}
                    onClick={() => set("priceMode", "oner")}
                  >
                    Fiyat öner
                  </Button>
                  <Button
                    type="button" size="sm"
                    variant={input.priceMode === "test" ? "default" : "outline"}
                    onClick={() => set("priceMode", "test")}
                  >
                    Fiyatımı test et
                  </Button>
                </div>
                {input.priceMode === "test" && (
                  <div className="mt-4">
                    <MoneyField
                      label="Kendi satış fiyatım (KDV hariç)" suffix={sym}
                      value={input.kendiFiyat} onChange={(v) => set("kendiFiyat", v)}
                      hint="Senaryo tablosu ve başabaş bu fiyatla hesaplanır."
                    />
                  </div>
                )}
              </div>

              {/* ── SONUÇ ── */}
              <div className={`${tab === "sonuc" ? "block" : "hidden"} lg:block`}>
                <div className="lg:sticky lg:top-24">
                  <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
                    <Button size="sm" variant="outline" onClick={handlePrint} disabled={!result.valid}>
                      <Printer className="h-4 w-4 me-1.5" /> Sonucu indir (PDF)
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleShare} disabled={!result.valid}>
                      {copied ? <Check className="h-4 w-4 me-1.5 text-emerald-600" /> : <Link2 className="h-4 w-4 me-1.5" />}
                      {copied ? "Link kopyalandı" : "Hesabı link olarak kopyala"}
                    </Button>
                  </div>
                  <p className="mb-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 no-print inline-flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
                    Link seçeneği maliyet yapınızı bağlantının içinde taşır — yalnız güvendiğiniz kişilerle paylaşın.
                  </p>
                  <div className="max-h-[75vh] overflow-y-auto rounded-lg">
                    <ResultPanel input={input} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Kardeş makale — prerender'da statik */}
      <section className="container mx-auto px-4 max-w-3xl py-10 no-print">
        <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{ARTICLE_MD}</ReactMarkdown>
        </article>
      </section>

      {/* CTA */}
      <section className="py-12 bg-muted/30 no-print">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-xl font-bold mb-3">{cta.heading}</h2>
          <p className="text-muted-foreground mb-5">{cta.body}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <a href={DEMO_WA_URL} target="_blank" rel="noopener noreferrer"
                onClick={() => trackToolEvent("cta", { tool: TOOL.id, target: "whatsapp" })}>
                {cta.primary}
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={SIGNUP_URL}
                onClick={() => trackToolEvent("cta", { tool: TOOL.id, target: "signup" })}>
                {cta.secondary}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
