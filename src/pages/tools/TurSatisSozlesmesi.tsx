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
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Printer, ShieldCheck, Download, Upload, AlertCircle, Plus, X } from "lucide-react";
import { extractFaq, buildFaqSchema, ctaTexts, DEMO_WA_URL, SIGNUP_URL } from "@/lib/blog-anatomy";
import { trackToolEvent } from "@/components/MetaPixel";
import { TOOLS } from "@/lib/tools/registry";
import { ARTICLE_MD } from "@/lib/tools/tur-satis-sozlesmesi/article";
import {
  INITIAL_DATA, INCLUDED_SUGGESTIONS, EXCLUDED_SUGGESTIONS, M8_LADDER_TEMPLATE,
  missingRequired, isDirty, newId, participantCount,
  type SalesContractData, type ServiceItem, type RefundRow,
} from "@/lib/tools/tur-satis-sozlesmesi/schema";
import {
  contractSpec, prebriefSpec, deliveryDateWarning,
  CONTRACT_TITLE, PREBRIEF_TITLE, LAWYER_NOTE_TOP, LAWYER_NOTE_BOTTOM, BRAND_LINE,
} from "@/lib/tools/tur-satis-sozlesmesi/clauses";
import type { DocSpec } from "@/lib/tools/docx";

// ARAÇ-4 / Tur Satış Sözleşmesi + Ön Bilgilendirme Formu.
// TEK FORM → İKİ BELGE. Ortak alanlar bir kez girilir; merdiven tek state'ten
// iki belgeye de işlenir (çelişme mimari olarak imkânsız).
// PRERENDER: iskelet statik; form YALNIZ client-mount sonrası (mounted guard).
// Belge üretim modülü TIKLAMADA lazy import edilir → ilk bundle'a girmez.

const TOOL = TOOLS.find((t) => t.id === "tur-satis-sozlesmesi")!;
const PAGE_TITLE = "Tur Satış Sözleşmesi ve Ön Bilgilendirme Formu Oluşturucu (Ücretsiz)";
const PAGE_DESC =
  "Tek formu doldurun, paket tur satış sözleşmesi ile ön bilgilendirme formunu birlikte oluşturun; Word veya PDF olarak indirin. Kayıt yok, bilgileriniz cihazınızdan çıkmaz.";

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

/** Öneri çipleri + serbest ekleme — dahil/hariç listeleri için ortak */
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
        <Input
          value={free} placeholder="Kendi kalemini yaz…"
          onChange={(e) => setFree(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
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

/** İptal merdiveni düzenleyici — oranları BOŞ getirir (uydurma tarife yasağı) */
function LadderEditor({ rows, onChange }: { rows: RefundRow[]; onChange: (r: RefundRow[]) => void }) {
  const fillTemplate = () =>
    onChange(M8_LADDER_TEMPLATE.map((t) => ({ id: newId("m"), sure: t.sure, iade: "" })));
  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p className="mb-3">
            Merdiven boş. Örnek yapıyı getirebilirsiniz — <strong className="text-foreground">gün aralıkları dolu gelir, iade
            oranlarını siz yazarsınız.</strong> Hazır oran vermiyoruz: doğru oran sizin maliyet yapınıza bağlıdır.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={fillTemplate}>
            Örnek yapıyı getir (4 satır)
          </Button>
        </div>
      )}
      {rows.map((r, i) => (
        <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            {i === 0 && <Label className="text-xs text-muted-foreground">Kalkışa kalan süre</Label>}
            <Input
              value={r.sure} placeholder="ör. 15-30 gün"
              onChange={(e) => { const n = [...rows]; n[i] = { ...r, sure: e.target.value }; onChange(n); }}
            />
          </div>
          <div>
            {i === 0 && <Label className="text-xs text-muted-foreground">Uygulanacak iade yaklaşımı</Label>}
            <Input
              value={r.iade} placeholder="ör. tedarikçi avansı düşülerek iade"
              onChange={(e) => { const n = [...rows]; n[i] = { ...r, iade: e.target.value }; onChange(n); }}
            />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Satırı sil" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { id: newId("m"), sure: "", iade: "" }])}>
            <Plus className="h-3.5 w-3.5 me-1" /> Satır ekle
          </Button>
          {M8_LADDER_TEMPLATE.map((t, i) => rows[i] ? null : null)}
        </div>
      )}
      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          İpucu — {M8_LADDER_TEMPLATE.map((t) => t.ipucu).join(" · ")}
        </p>
      )}
    </div>
  );
}

/** Belge önizlemesi — DocSpec'ten render; yazdırılan DOM budur */
function DocPreview({ spec, id }: { spec: DocSpec; id: string }) {
  return (
    <div id={id} className="doc-preview bg-white text-black rounded-lg border border-border p-6 md:p-8 text-[13px] leading-relaxed">
      <h2 className="text-center font-bold text-base mb-1">{spec.baslik}</h2>
      <p className="text-center italic text-[11px] text-neutral-600 mb-5">{spec.ustNot}</p>
      {spec.bolumler.map((s, i) => (
        <div key={i} className="mb-4">
          <h3 className="font-bold text-[13px] mb-1.5">
            {s.no === null ? s.baslik.toLocaleUpperCase("tr-TR") : `MADDE ${s.no} — ${s.baslik.toLocaleUpperCase("tr-TR")}`}
          </h3>
          {s.paragraflar.map((p, j) => (
            <p key={j} className="mb-1.5 text-justify">{p}</p>
          ))}
          {s.tablo && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px] my-2">
                <thead>
                  <tr>
                    {s.tablo.basliklar.map((h) => (
                      <th key={h} className="border border-neutral-400 bg-neutral-100 p-1.5 text-start">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.tablo.satirlar.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((c, ci) => <td key={ci} className="border border-neutral-400 p-1.5">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      {spec.beyan && (
        <p className="mt-6 border border-neutral-400 p-3 text-[12px]">{spec.beyan}</p>
      )}
      <div className="grid grid-cols-2 gap-6 mt-8">
        {spec.imzalar.map((s) => (
          <div key={s.rol}>
            <p className="font-bold mb-8">{s.rol}</p>
            <p className="border-t border-black pt-1">{s.isim}</p>
            {s.altNot && <p className="text-[11px] text-neutral-600 mt-0.5">{s.altNot}</p>}
            <p className="text-[11px] text-neutral-600 mt-1">Kaşe / İmza</p>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-neutral-400 pt-2 text-[11px] text-neutral-600">
        <p className="mb-1">{spec.altNot}</p>
        <p>{spec.markaSatiri}</p>
      </div>
    </div>
  );
}

export default function TurSatisSozlesmesi() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"form" | "sozlesme" | "form2">("form");
  const [docTab, setDocTab] = useState<"sozlesme" | "onbilgi">("sozlesme");
  const [data, setData] = useState<SalesContractData>(INITIAL_DATA);

  const faq = useMemo(() => extractFaq(ARTICLE_MD), []);
  const faqSchema = useMemo(() => buildFaqSchema(faq), [faq]);
  const cta = ctaTexts("tr");

  const eksik = missingRequired(data);
  const tarihUyari = deliveryDateWarning(data);

  useEffect(() => {
    setMounted(true);
    trackToolEvent("view", { tool: TOOL.id });
  }, []);

  // Doldurulmuş formda sekme/sayfa kapatma koruması
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (isDirty(data)) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [data]);

  const set = <K extends keyof SalesContractData>(k: K, v: SalesContractData[K]) =>
    setData((p) => ({ ...p, [k]: v }));

  const runExport = async (kind: "sozlesme" | "onbilgi" | "pdf" | "taslak-indir" | "taslak-yukle", file?: File) => {
    const mod = await import("@/lib/tools/tur-satis-sozlesmesi/export");
    if (kind === "sozlesme") { mod.downloadContract(data); trackToolEvent("download", { tool: TOOL.id, format: "doc", target: "sozlesme" }); }
    else if (kind === "onbilgi") { mod.downloadPrebrief(data); trackToolEvent("download", { tool: TOOL.id, format: "doc", target: "on-bilgilendirme" }); }
    else if (kind === "pdf") { trackToolEvent("download", { tool: TOOL.id, format: "pdf", target: docTab }); mod.printDocument(); }
    else if (kind === "taslak-indir") mod.downloadDraft(data);
    else if (kind === "taslak-yukle" && file) {
      const text = await file.text();
      try { setData({ ...INITIAL_DATA, ...JSON.parse(text) }); } catch { /* bozuk taslak yok sayılır */ }
    }
  };

  const spec = docTab === "sozlesme" ? contractSpec(data) : prebriefSpec(data);

  return (
    <Layout>
      <SEOHead title={PAGE_TITLE} description={PAGE_DESC} canonical={TOOL.path.tr} schema={faqSchema} />

      <section className="py-10 bg-gradient-to-b from-orange-50/30 to-background dark:from-orange-950/10 no-print">
        <div className="container mx-auto px-4 max-w-6xl">
          <nav className="text-xs text-muted-foreground mb-3">
            <Link to="/araclar" className="hover:text-primary">Araçlar</Link>
            <span className="mx-1.5">/</span>
            <span>Tur Satış Sözleşmesi ve Ön Bilgilendirme Formu</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-bold mb-3 flex items-start gap-2.5">
            <FileText className="h-7 w-7 text-orange-500 shrink-0 mt-0.5" />
            Tur Satış Sözleşmesi ve Ön Bilgilendirme Formu Oluşturucu
          </h1>
          <p className="text-muted-foreground max-w-3xl">{PAGE_DESC}</p>
          <p className="mt-3 inline-flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-px" />
            Tek formu doldurun, iki belge birlikte üretilsin. Bilgileriniz sunucumuza gönderilmez.
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
              <Button variant={tab !== "form" ? "default" : "outline"} size="sm" onClick={() => setTab("sozlesme")}>Belgeler</Button>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* ── FORM ── */}
              <div className={`${tab === "form" ? "block" : "hidden"} lg:block no-print`}>
                <SectionTitle>Acente bilgileri</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Acente unvanı" required><Input value={data.acenteUnvan} onChange={(e) => set("acenteUnvan", e.target.value)} /></Field>
                  <Field label="TÜRSAB belge no"><Input value={data.acenteTursab} onChange={(e) => set("acenteTursab", e.target.value)} /></Field>
                  <Field label="Adres"><Input value={data.acenteAdres} onChange={(e) => set("acenteAdres", e.target.value)} /></Field>
                  <Field label="Telefon"><Input value={data.acenteTelefon} onChange={(e) => set("acenteTelefon", e.target.value)} /></Field>
                  <Field label="E-posta"><Input value={data.acenteEposta} onChange={(e) => set("acenteEposta", e.target.value)} /></Field>
                  <Field label="Vergi no"><Input value={data.acenteVergi} onChange={(e) => set("acenteVergi", e.target.value)} /></Field>
                </div>

                <SectionTitle>Müşteri ve katılımcılar</SectionTitle>
                <p className="text-xs text-muted-foreground -mt-2 mb-4">
                  T.C. kimlik numarası istemiyoruz — belgenin işlemesi için gerekli değil.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Müşteri ad-soyad" required><Input value={data.musteriAd} onChange={(e) => set("musteriAd", e.target.value)} /></Field>
                  <Field label="Telefon"><Input value={data.musteriTelefon} onChange={(e) => set("musteriTelefon", e.target.value)} /></Field>
                  <Field label="Adres"><Input value={data.musteriAdres} onChange={(e) => set("musteriAdres", e.target.value)} /></Field>
                  <Field label="E-posta"><Input value={data.musteriEposta} onChange={(e) => set("musteriEposta", e.target.value)} /></Field>
                  <Field label="Yetişkin sayısı" required><Input type="text" inputMode="numeric" value={data.yetiskinSayisi} onChange={(e) => set("yetiskinSayisi", e.target.value)} /></Field>
                  <Field label="Çocuk sayısı"><Input type="text" inputMode="numeric" value={data.cocukSayisi} onChange={(e) => set("cocukSayisi", e.target.value)} /></Field>
                </div>
                <div className="mt-4">
                  <Field label="Katılımcı adları" hint="Her satıra bir kişi. Boş bırakırsanız belgede bu satır görünmez.">
                    <Textarea rows={3} value={data.katilimciAdlari} onChange={(e) => set("katilimciAdlari", e.target.value)} />
                  </Field>
                </div>

                <SectionTitle>Tur bilgileri</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Tur adı" required><Input value={data.turAdi} onChange={(e) => set("turAdi", e.target.value)} /></Field>
                  <Field label="Güzergâh"><Input value={data.guzergah} onChange={(e) => set("guzergah", e.target.value)} /></Field>
                  <Field label="Başlangıç tarihi" required><Input type="date" value={data.baslangicTarihi} onChange={(e) => set("baslangicTarihi", e.target.value)} /></Field>
                  <Field label="Bitiş tarihi"><Input type="date" value={data.bitisTarihi} onChange={(e) => set("bitisTarihi", e.target.value)} /></Field>
                  <Field label="Konaklama tesisi"><Input value={data.tesisAdi} onChange={(e) => set("tesisAdi", e.target.value)} /></Field>
                  <Field label="Oda tipi"><Input value={data.odaTipi} onChange={(e) => set("odaTipi", e.target.value)} /></Field>
                  <Field label="Gece sayısı"><Input type="text" inputMode="numeric" value={data.geceSayisi} onChange={(e) => set("geceSayisi", e.target.value)} /></Field>
                  <Field label="Ulaşım türü"><Input value={data.ulasimTuru} onChange={(e) => set("ulasimTuru", e.target.value)} placeholder="ör. 45 kişilik otobüs" /></Field>
                </div>

                <SectionTitle>Fiyata dahil hizmetler</SectionTitle>
                <ServicePicker items={data.dahilHizmetler} onChange={(v) => set("dahilHizmetler", v)} suggestions={INCLUDED_SUGGESTIONS} tone="dahil" />

                <SectionTitle>Fiyata dahil OLMAYAN hizmetler</SectionTitle>
                <p className="text-xs text-muted-foreground -mt-2 mb-4">
                  Anlaşmazlıkların ana kaynağı burasıdır. Müşteri listede olmayanı eksik değil, <strong>dahil</strong> sayar.
                </p>
                <ServicePicker items={data.haricHizmetler} onChange={(v) => set("haricHizmetler", v)} suggestions={EXCLUDED_SUGGESTIONS} tone="haric" />

                <SectionTitle>Bedel ve ödeme</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Tutar" required><Input value={data.bedelTutar} onChange={(e) => set("bedelTutar", e.target.value)} /></Field>
                  <Field label="Para birimi"><Input value={data.paraBirimi} onChange={(e) => set("paraBirimi", e.target.value)} /></Field>
                </div>
                <div className="mt-4 space-y-1.5">
                  <Label className="text-sm">Girilen tutar</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" size="sm" variant={data.bedelBazi === "kisi" ? "default" : "outline"} onClick={() => set("bedelBazi", "kisi")}>Kişi başı</Button>
                    <Button type="button" size="sm" variant={data.bedelBazi === "toplam" ? "default" : "outline"} onClick={() => set("bedelBazi", "toplam")}>Toplam</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Belgeye ikisi birden yazılır{participantCount(data) > 0 ? ` (${participantCount(data)} katılımcı)` : ""} — sonradan tartışma çıkmasın.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <Field label="Kapora tutarı"><Input value={data.kaporaTutar} onChange={(e) => set("kaporaTutar", e.target.value)} /></Field>
                  <Field label="Bakiye ödeme vadesi"><Input value={data.kalanVade} onChange={(e) => set("kalanVade", e.target.value)} placeholder="ör. kalkıştan 15 gün önce" /></Field>
                </div>
                <div className="mt-4">
                  <Field label="Ödeme yolları"><Input value={data.odemeYollari} onChange={(e) => set("odemeYollari", e.target.value)} placeholder="ör. banka havalesi, kredi kartı" /></Field>
                </div>

                <SectionTitle>İptal ve iade merdiveni</SectionTitle>
                <LadderEditor rows={data.merdiven} onChange={(v) => set("merdiven", v)} />
                <label className="flex items-start gap-2 mt-4 text-sm cursor-pointer">
                  <Checkbox checked={data.devirAlternatifi} onCheckedChange={(v) => set("devirAlternatifi", v === true)} />
                  <span>Tarih değişikliği / başka katılımcıya devir alternatifi sunuluyor</span>
                </label>

                <SectionTitle>Tarihler ve ek koşullar</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Sözleşme tarihi"><Input type="date" value={data.sozlesmeTarihi} onChange={(e) => set("sozlesmeTarihi", e.target.value)} /></Field>
                  <Field label="Ön bilgilendirme teslim tarihi" hint="Satıştan ÖNCE olmalı — belgenin ispat işlevi buradan gelir.">
                    <Input type="date" value={data.formTeslimTarihi} onChange={(e) => set("formTeslimTarihi", e.target.value)} />
                  </Field>
                  <Field label="Düzenleme yeri"><Input value={data.duzenlemeYeri} onChange={(e) => set("duzenlemeYeri", e.target.value)} /></Field>
                  <Field label="Şikâyet kanalı" hint="Boşsa acente telefonu kullanılır."><Input value={data.sikayetKanali} onChange={(e) => set("sikayetKanali", e.target.value)} /></Field>
                </div>
                {tarihUyari && (
                  <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 inline-flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
                    Ön bilgilendirme teslim tarihi sözleşme tarihinden sonra. Bu form satıştan önce verilmiş olmalıdır.
                  </p>
                )}
                <div className="mt-4">
                  <Field label="Ek koşullar" hint="Boş bırakırsanız bu madde belgeye hiç girmez.">
                    <Textarea rows={3} value={data.ekKosullar} onChange={(e) => set("ekKosullar", e.target.value)} />
                  </Field>
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

              {/* ── ÇİFT ÖNİZLEME ── */}
              <div className={`${tab !== "form" ? "block" : "hidden"} lg:block`}>
                <div className="lg:sticky lg:top-24">
                  {/* Belge sekmeleri */}
                  <div className="grid grid-cols-2 gap-2 mb-3 no-print">
                    <Button size="sm" variant={docTab === "sozlesme" ? "default" : "outline"} onClick={() => setDocTab("sozlesme")}>
                      {CONTRACT_TITLE.replace("PAKET TUR ", "")}
                    </Button>
                    <Button size="sm" variant={docTab === "onbilgi" ? "default" : "outline"} onClick={() => setDocTab("onbilgi")}>
                      Ön Bilgilendirme
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
                    <Button size="sm" variant="outline" onClick={() => runExport("sozlesme")}>
                      <Download className="h-4 w-4 me-1.5" /> Sözleşme (Word)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runExport("onbilgi")}>
                      <Download className="h-4 w-4 me-1.5" /> Ön Bilgilendirme (Word)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runExport("pdf")}>
                      <Printer className="h-4 w-4 me-1.5" /> PDF (görünen belge)
                    </Button>
                  </div>

                  {eksik.length > 0 && (
                    <p className="mb-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 no-print inline-flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
                      Eksik alanlar: {eksik.join(", ")}
                    </p>
                  )}

                  <div className="max-h-[75vh] overflow-y-auto rounded-lg print-area">
                    <DocPreview spec={spec} id={docTab === "sozlesme" ? "sozlesme-onizleme" : "onbilgi-onizleme"} />
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
                onClick={() => trackToolEvent("cta", { tool: TOOL.id, target: "whatsapp" })}>
                {cta.primary}
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={SIGNUP_URL} onClick={() => trackToolEvent("cta", { tool: TOOL.id, target: "signup" })}>
                {cta.secondary}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
