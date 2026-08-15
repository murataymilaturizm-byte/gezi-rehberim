import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Printer, ShieldCheck, Download, Upload, AlertCircle, Plus, X, Image as ImageIcon } from "lucide-react";
import { extractFaq, buildFaqSchema, ctaTexts, DEMO_WA_URL, SIGNUP_URL } from "@/lib/blog-anatomy";
import { trackToolEvent } from "@/components/MetaPixel";
import { TOOLS } from "@/lib/tools/registry";
import { ARTICLE_MD } from "@/lib/tools/tur-teklifi/article";
import {
  INITIAL_OFFER, INCLUDED_SUGGESTIONS, EXCLUDED_SUGGESTIONS, LOGO_MAX_BYTES, LOGO_MAX_WIDTH,
  newId, rangeIssues, missingRequired, isDirty,
  type OfferData, type ServiceItem, type PriceRow,
} from "@/lib/tools/tur-teklifi/schema";
import { offerSpec, validityLine } from "@/lib/tools/tur-teklifi/document";

// ARAÇ-5 / Tur Teklifi Oluşturucu.
// Teklif TİCARİ belgedir → avukat/örnek-iskelet notu YOK, imza bloğu YOK.
// PRERENDER: iskelet statik; form YALNIZ client-mount sonrası (mounted guard).
// Belge modülü TIKLAMADA lazy import edilir. Yeni kütüphane YOK.
// LOGO: önizleme + PDF'de görünür, Word çıktısında YOK (ölçüm: Word data-URI
// görselini gömmüyor — InlineShapes 0). Form bunu kullanıcıya açıkça söyler.

const TOOL = TOOLS.find((t) => t.id === "tur-teklifi")!;
const PAGE_TITLE = "Tur Teklifi Oluşturucu — Ücretsiz Profesyonel Teklif Şablonu";
const PAGE_DESC =
  "Grup ve kurumsal turlar için başlıklı, fiyat tablolu profesyonel teklif belgesi hazırlayın; Word veya PDF olarak indirin. Kayıt yok, bilgileriniz cihazınızdan çıkmaz.";

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}{" "}
        {required ? <span className="text-orange-500">*</span> : <span className="text-muted-foreground text-xs">(opsiyonel)</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide border-b border-border pb-2 mb-4 mt-8 first:mt-0">
      {children}
    </h3>
  );
}

/** Öneri çipleri + serbest ekleme — ARAÇ-4 ile aynı desen, ortak listeden beslenir */
function ServicePicker({
  items, onChange, suggestions, tone,
}: { items: ServiceItem[]; onChange: (v: ServiceItem[]) => void; suggestions: readonly string[]; tone: "dahil" | "haric" }) {
  const [free, setFree] = useState("");
  const has = (l: string) => items.some((i) => i.label === l);
  const toggle = (l: string) =>
    onChange(has(l) ? items.filter((i) => i.label !== l) : [...items, { id: newId("s"), label: l }]);
  const add = () => {
    const l = free.trim();
    if (!l || has(l)) return;
    onChange([...items, { id: newId("s"), label: l }]);
    setFree("");
  };
  const chipCls = (on: boolean) =>
    `text-xs rounded-full border px-2.5 py-1 transition-colors ${
      on
        ? tone === "dahil"
          ? "bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : "bg-background border-border text-muted-foreground hover:border-foreground/40"
    }`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button key={s} type="button" className={chipCls(has(s))} onClick={() => toggle(s)}>
            {has(s) ? "✓ " : "+ "}{s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={free} placeholder="Kendi kalemini yaz…"
          onChange={(e) => setFree(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 me-1" /> Ekle
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 text-sm bg-muted/40 rounded px-2.5 py-1.5">
              <span>{i.label}</span>
              <button type="button" aria-label="Kaldır" onClick={() => onChange(items.filter((x) => x.id !== i.id))}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Teklif önizlemesi — yazdırılan DOM budur (logo dahil) */
function OfferPreview({ data }: { data: OfferData }) {
  const spec = offerSpec(data);
  return (
    <div id="teklif-onizleme" className="doc-preview bg-white text-black rounded-lg border border-border p-6 md:p-8 text-[13px] leading-relaxed">
      {data.logoDataUrl && (
        <div className="mb-4">
          <img src={data.logoDataUrl} alt="" className="max-h-20 w-auto" />
        </div>
      )}
      <h2 className="text-center font-bold text-base mb-5">{spec.baslik}</h2>
      {spec.bolumler.map((s, i) => (
        <div key={i} className="mb-4">
          <h3 className="font-bold text-[13px] mb-1.5">{s.baslik.toLocaleUpperCase("tr-TR")}</h3>
          {s.paragraflar.map((p, j) => <p key={j} className="mb-1.5 text-justify">{p}</p>)}
          {s.tablo && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px] my-2">
                <thead>
                  <tr>{s.tablo.basliklar.map((h) => (
                    <th key={h} className="border border-neutral-400 bg-neutral-100 p-1.5 text-start">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {s.tablo.satirlar.map((r, ri) => (
                    <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-neutral-400 p-1.5">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      <div className="mt-6 border-t border-neutral-400 pt-2 text-[11px] text-neutral-600">
        {spec.altNot && <p className="mb-1">{spec.altNot}</p>}
        <p>{spec.markaSatiri}</p>
      </div>
    </div>
  );
}

export default function TurTeklifi() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"form" | "onizleme">("form");
  const [data, setData] = useState<OfferData>(INITIAL_OFFER);
  const [logoUyari, setLogoUyari] = useState("");

  const faq = useMemo(() => extractFaq(ARTICLE_MD), []);
  const faqSchema = useMemo(() => buildFaqSchema(faq), [faq]);
  const cta = ctaTexts("tr");
  const issues = rangeIssues(data);
  const eksik = missingRequired(data);

  useEffect(() => { setMounted(true); trackToolEvent("view", { tool: TOOL.id }); }, []);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (isDirty(data)) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [data]);

  const set = <K extends keyof OfferData>(k: K, v: OfferData[K]) => setData((p) => ({ ...p, [k]: v }));

  /** Logo: tarayıcıda okunur, canvas ile küçültülür — hiçbir yere yüklenmez */
  const onLogo = (file: File) => {
    setLogoUyari("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const oran = Math.min(1, LOGO_MAX_WIDTH / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * oran);
        c.height = Math.round(img.height * oran);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/png");
        if (url.length > LOGO_MAX_BYTES * 1.4) {
          setLogoUyari("Logo çok büyük — daha küçük bir görsel deneyin.");
          return;
        }
        set("logoDataUrl", url);
      };
      img.onerror = () => setLogoUyari("Görsel okunamadı.");
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const runExport = async (kind: "doc" | "pdf" | "taslak-indir" | "taslak-yukle", file?: File) => {
    const mod = await import("@/lib/tools/tur-teklifi/export");
    if (kind === "doc") { mod.downloadOffer(data); trackToolEvent("download", { tool: TOOL.id, format: "doc" }); }
    else if (kind === "pdf") { trackToolEvent("download", { tool: TOOL.id, format: "pdf" }); mod.printDocument(); }
    else if (kind === "taslak-indir") mod.downloadDraft(data);
    else if (kind === "taslak-yukle" && file) {
      const text = await file.text();
      try { setData({ ...INITIAL_OFFER, ...JSON.parse(text) }); } catch { /* bozuk taslak yok sayılır */ }
    }
  };

  const gecerlilikGunEkle = (gun: number) => {
    const d = new Date();
    d.setDate(d.getDate() + gun);
    set("gecerlilikTarihi", d.toISOString().slice(0, 10));
  };

  return (
    <Layout>
      <SEOHead title={PAGE_TITLE} description={PAGE_DESC} canonical={TOOL.path.tr} schema={faqSchema} />

      <section className="py-10 bg-gradient-to-b from-orange-50/30 to-background dark:from-orange-950/10 no-print">
        <div className="container mx-auto px-4 max-w-6xl">
          <nav className="text-xs text-muted-foreground mb-3">
            <Link to="/araclar" className="hover:text-primary">Araçlar</Link>
            <span className="mx-1.5">/</span><span>Tur Teklifi Oluşturucu</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-bold mb-3 flex items-start gap-2.5">
            <FileText className="h-7 w-7 text-orange-500 shrink-0 mt-0.5" />
            Tur Teklifi Oluşturucu
          </h1>
          <p className="text-muted-foreground max-w-3xl">{PAGE_DESC}</p>
          <p className="mt-3 inline-flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-px" />
            Bilgileriniz ve logonuz sunucumuza gönderilmez; belge tamamen tarayıcınızda oluşturulur.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 max-w-6xl py-8">
        {!mounted ? (
          <div className="min-h-[560px] rounded-xl border border-border bg-muted/20 flex items-center justify-center no-print">
            <span className="text-sm text-muted-foreground">Form yükleniyor…</span>
          </div>
        ) : (
          <>
            <div className="lg:hidden grid grid-cols-2 gap-2 mb-5 no-print">
              <Button variant={tab === "form" ? "default" : "outline"} size="sm" onClick={() => setTab("form")}>Form</Button>
              <Button variant={tab === "onizleme" ? "default" : "outline"} size="sm" onClick={() => setTab("onizleme")}>Teklif</Button>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* FORM */}
              <div className={`${tab === "form" ? "block" : "hidden"} lg:block no-print`}>
                <SectionTitle>Acente bilgileri</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Acente unvanı" required><Input value={data.acenteUnvan} onChange={(e) => set("acenteUnvan", e.target.value)} /></Field>
                  <Field label="TÜRSAB belge no"><Input value={data.acenteTursab} onChange={(e) => set("acenteTursab", e.target.value)} /></Field>
                  <Field label="Telefon"><Input value={data.acenteTelefon} onChange={(e) => set("acenteTelefon", e.target.value)} /></Field>
                  <Field label="E-posta"><Input value={data.acenteEposta} onChange={(e) => set("acenteEposta", e.target.value)} /></Field>
                  <Field label="Adres"><Input value={data.acenteAdres} onChange={(e) => set("acenteAdres", e.target.value)} /></Field>
                  <Field label="Teklif no" hint="ör. 2026-014 — boşsa belgeye girmez"><Input value={data.teklifNo} onChange={(e) => set("teklifNo", e.target.value)} /></Field>
                </div>

                <div className="mt-4 space-y-1.5">
                  <Label className="text-sm">Logo <span className="text-muted-foreground text-xs">(opsiyonel)</span></Label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span><ImageIcon className="h-4 w-4 me-1.5" /> Logo seç</span>
                      </Button>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = ""; }} />
                    </label>
                    {data.logoDataUrl && (
                      <>
                        <img src={data.logoDataUrl} alt="" className="h-8 w-auto rounded border border-border" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => set("logoDataUrl", "")}>Kaldır</Button>
                      </>
                    )}
                  </div>
                  {/* ŞART ①: logo'nun nerede görüneceği formda AÇIKÇA yazar */}
                  <p className="text-xs text-muted-foreground">
                    Logo PDF'de yer alır; Word düzenleme-kopyasıdır (logosuz gelir). Görsel cihazınızdan çıkmaz.
                  </p>
                  {logoUyari && <p className="text-xs text-amber-700 dark:text-amber-400">{logoUyari}</p>}
                </div>

                <SectionTitle>Muhatap</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Kişi / kurum adı" required><Input value={data.muhatapAd} onChange={(e) => set("muhatapAd", e.target.value)} /></Field>
                  <Field label="Firma"><Input value={data.muhatapFirma} onChange={(e) => set("muhatapFirma", e.target.value)} /></Field>
                </div>

                <SectionTitle>Tur bilgileri</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Tur adı" required><Input value={data.turAdi} onChange={(e) => set("turAdi", e.target.value)} /></Field>
                  <Field label="Güzergâh"><Input value={data.guzergah} onChange={(e) => set("guzergah", e.target.value)} /></Field>
                  <Field label="Tarihler"><Input value={data.tarihler} onChange={(e) => set("tarihler", e.target.value)} placeholder="ör. 10-12 Eylül 2026" /></Field>
                  <Field label="Süre"><Input value={data.sure} onChange={(e) => set("sure", e.target.value)} placeholder="ör. 2 gece 3 gün" /></Field>
                </div>

                <SectionTitle>Program</SectionTitle>
                <p className="text-xs text-muted-foreground -mt-2 mb-3">
                  Satırlar otomatik "Gün 1, Gün 2…" olarak numaralanır. Tek satır yazarsanız gün başlığı basılmaz.
                </p>
                <div className="space-y-2">
                  {data.program.map((r, i) => (
                    <div key={r.id} className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground w-12 pt-2.5 shrink-0">
                        {data.program.filter((x) => x.metin.trim()).length > 1 ? `Gün ${i + 1}` : "—"}
                      </span>
                      <Textarea rows={2} value={r.metin}
                        onChange={(e) => { const n = [...data.program]; n[i] = { ...r, metin: e.target.value }; set("program", n); }} />
                      <Button type="button" variant="ghost" size="icon" aria-label="Satırı sil"
                        onClick={() => set("program", data.program.filter((x) => x.id !== r.id))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => set("program", [...data.program, { id: newId("p"), metin: "" }])}>
                    <Plus className="h-3.5 w-3.5 me-1" /> Gün ekle
                  </Button>
                </div>

                <SectionTitle>Fiyata dahil olanlar</SectionTitle>
                <ServicePicker items={data.dahilHizmetler} onChange={(v) => set("dahilHizmetler", v)} suggestions={INCLUDED_SUGGESTIONS} tone="dahil" />

                <SectionTitle>Fiyata dahil OLMAYANLAR</SectionTitle>
                <p className="text-xs text-muted-foreground -mt-2 mb-4">
                  Şeffaflık satış kaybettirmez — yazılmayan kalem, tur sonrası güven kaybettirir.
                </p>
                <ServicePicker items={data.haricHizmetler} onChange={(v) => set("haricHizmetler", v)} suggestions={EXCLUDED_SUGGESTIONS} tone="haric" />

                <SectionTitle>Fiyat</SectionTitle>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <Button type="button" size="sm" variant={data.priceMode === "aralik" ? "default" : "outline"} onClick={() => set("priceMode", "aralik")}>
                    Kişi aralıklı tablo
                  </Button>
                  <Button type="button" size="sm" variant={data.priceMode === "tek" ? "default" : "outline"} onClick={() => set("priceMode", "tek")}>
                    Tek fiyat
                  </Button>
                </div>

                {data.priceMode === "tek" ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Kişi başı fiyat" required><Input value={data.tekFiyat} onChange={(e) => set("tekFiyat", e.target.value)} /></Field>
                    <Field label="Para birimi"><Input value={data.paraBirimi} onChange={(e) => set("paraBirimi", e.target.value)} /></Field>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.fiyatSatirlari.map((r, i) => (
                      <div key={r.id} className="grid grid-cols-[1fr_1fr_1.3fr_auto] gap-2 items-end">
                        {i === 0 && <><Label className="text-xs text-muted-foreground col-start-1">En az kişi</Label></>}
                        <Input value={r.minKisi} placeholder="20" inputMode="numeric"
                          onChange={(e) => { const n = [...data.fiyatSatirlari]; n[i] = { ...r, minKisi: e.target.value }; set("fiyatSatirlari", n); }} />
                        <Input value={r.maxKisi} placeholder="29 (boş = ve üzeri)" inputMode="numeric"
                          onChange={(e) => { const n = [...data.fiyatSatirlari]; n[i] = { ...r, maxKisi: e.target.value }; set("fiyatSatirlari", n); }} />
                        <Input value={r.fiyat} placeholder="kişi başı fiyat"
                          onChange={(e) => { const n = [...data.fiyatSatirlari]; n[i] = { ...r, fiyat: e.target.value }; set("fiyatSatirlari", n); }} />
                        <Button type="button" variant="ghost" size="icon" aria-label="Satırı sil"
                          onClick={() => set("fiyatSatirlari", data.fiyatSatirlari.filter((x) => x.id !== r.id))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 items-center">
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => set("fiyatSatirlari", [...data.fiyatSatirlari, { id: newId("f"), minKisi: "", maxKisi: "", fiyat: "" }])}>
                        <Plus className="h-3.5 w-3.5 me-1" /> Fiyat satırı ekle
                      </Button>
                      <div className="w-28">
                        <Input value={data.paraBirimi} onChange={(e) => set("paraBirimi", e.target.value)} placeholder="TL" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Aralık tutarlılığı — NAZİK uyarı, engellemez */}
                {issues.length > 0 && (
                  <div className="mt-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                    <p className="font-medium mb-1 inline-flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" /> Fiyat aralıklarını gözden geçirin
                    </p>
                    <ul className="list-disc ps-5 space-y-0.5">
                      {issues.map((x, i) => <li key={i}>{x.mesaj}</li>)}
                    </ul>
                  </div>
                )}

                <div className="mt-4 space-y-1.5">
                  <Label className="text-sm">KDV</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" size="sm" variant={data.kdvModu === "haric" ? "default" : "outline"} onClick={() => set("kdvModu", "haric")}>KDV hariç</Button>
                    <Button type="button" size="sm" variant={data.kdvModu === "dahil" ? "default" : "outline"} onClick={() => set("kdvModu", "dahil")}>KDV dahil</Button>
                  </div>
                </div>

                <SectionTitle>Koşullar</SectionTitle>
                <Field label="Teklif geçerlilik tarihi" hint="Sonu belli olan teklif, nazik bir karar çağrısıdır.">
                  <Input type="date" value={data.gecerlilikTarihi} onChange={(e) => set("gecerlilikTarihi", e.target.value)} />
                </Field>
                <div className="flex gap-2 mt-2">
                  {[7, 15, 30].map((g) => (
                    <Button key={g} type="button" variant="outline" size="sm" onClick={() => gecerlilikGunEkle(g)}>+{g} gün</Button>
                  ))}
                </div>
                <div className="mt-4 space-y-4">
                  <Field label="Ödeme özeti" hint="ör. %30 kapora, bakiye kalkıştan 15 gün önce">
                    <Input value={data.odemeOzeti} onChange={(e) => set("odemeOzeti", e.target.value)} />
                  </Field>
                  <Field label="Ek notlar"><Textarea rows={3} value={data.ekNotlar} onChange={(e) => set("ekNotlar", e.target.value)} /></Field>
                </div>

                <div className="flex flex-wrap gap-2 mt-6">
                  <Button type="button" variant="outline" size="sm" onClick={() => runExport("taslak-indir")}>
                    <Download className="h-4 w-4 me-1.5" /> Taslağı indir
                  </Button>
                  <label className="inline-flex">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span><Upload className="h-4 w-4 me-1.5" /> Taslak yükle</span>
                    </Button>
                    <input type="file" accept="application/json" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) runExport("taslak-yukle", f); e.target.value = ""; }} />
                  </label>
                </div>
              </div>

              {/* ÖNİZLEME */}
              <div className={`${tab === "onizleme" ? "block" : "hidden"} lg:block`}>
                <div className="lg:sticky lg:top-24">
                  <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
                    <Button size="sm" variant="outline" onClick={() => runExport("pdf")}>
                      <Printer className="h-4 w-4 me-1.5" /> PDF olarak indir
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runExport("doc")}>
                      <Download className="h-4 w-4 me-1.5" /> Word olarak indir
                    </Button>
                  </div>
                  {eksik.length > 0 && (
                    <p className="mb-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 no-print inline-flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-px" /> Eksik alanlar: {eksik.join(", ")}
                    </p>
                  )}
                  <div className="max-h-[75vh] overflow-y-auto rounded-lg print-area">
                    <OfferPreview data={data} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="container mx-auto px-4 max-w-3xl py-10 no-print">
        <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{ARTICLE_MD}</ReactMarkdown>
        </article>
      </section>

      <section className="py-12 bg-muted/30 no-print">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-xl font-bold mb-3">{cta.heading}</h2>
          <p className="text-muted-foreground mb-5">{cta.body}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <a href={DEMO_WA_URL} target="_blank" rel="noopener noreferrer"
                onClick={() => trackToolEvent("cta", { tool: TOOL.id, target: "whatsapp" })}>{cta.primary}</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={SIGNUP_URL} onClick={() => trackToolEvent("cta", { tool: TOOL.id, target: "signup" })}>{cta.secondary}</a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
