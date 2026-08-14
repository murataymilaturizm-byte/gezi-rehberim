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
import { FileText, Printer, ShieldCheck, Download, Upload, AlertCircle } from "lucide-react";
import { extractFaq, buildFaqSchema, ctaTexts, DEMO_WA_URL, SIGNUP_URL } from "@/lib/blog-anatomy";
import { trackToolEvent } from "@/components/MetaPixel";
import { TOOLS } from "@/lib/tools/registry";
import { ARTICLE_MD } from "@/lib/tools/rehber-sozlesmesi/article";
import {
  INITIAL_DATA, EXPENSE_ITEMS, GUIDE_LANGUAGES, missingRequired, isDirty,
  type ContractData, type ExpenseKey, type ExpenseOwner,
} from "@/lib/tools/rehber-sozlesmesi/schema";
import {
  buildClauses, signatureBlocks, DOC_TITLE, BRAND_LINE, LAWYER_NOTE_TOP, LAWYER_NOTE_BOTTOM,
} from "@/lib/tools/rehber-sozlesmesi/clauses";

// ARAÇ-1 / Rehber Sözleşmesi Oluşturucu.
// PRERENDER: sayfa iskeleti (H1, açıklama, kardeş-makale, SSS, CTA) statik HTML'e
// girer; interaktif form YALNIZ client-mount sonrası render edilir (mounted guard).
// Belge üretim modülü TIKLAMADA lazy import edilir → ilk bundle'a hiç girmez.

const TOOL = TOOLS.find((t) => t.id === "rehber-sozlesmesi")!;
const PAGE_TITLE = "Rehber Sözleşmesi Oluşturucu — Ücretsiz Şablon (Word + PDF)";
const PAGE_DESC =
  "Acente ile tur rehberi arasındaki hizmet sözleşmesinin örnek iskeletini formu doldurarak oluşturun, Word veya PDF olarak indirin. Kayıt yok, bilgileriniz cihazınızdan çıkmaz.";

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label} {required ? <span className="text-orange-500">*</span> : <span className="text-muted-foreground text-xs">(opsiyonel)</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide border-b border-border pb-2 mb-4 mt-8 first:mt-0">{children}</h3>;
}

/** Canlı önizleme — AYNI DOM yazdırılır (@media print ile), ikinci render yolu yok */
function DocumentPreview({ data }: { data: ContractData }) {
  const clauses = buildClauses(data);
  const sigs = signatureBlocks(data);
  return (
    <div id="sozlesme-onizleme" className="doc-preview bg-white text-black rounded-lg border border-border p-6 md:p-8 text-[13px] leading-relaxed">
      <h2 className="text-center font-bold text-base mb-1">{DOC_TITLE}</h2>
      <p className="text-center italic text-[11px] text-neutral-600 mb-5">{LAWYER_NOTE_TOP}</p>
      {clauses.map((c) => (
        <div key={c.no} className="mb-4">
          <h3 className="font-bold text-[13px] mb-1">
            MADDE {c.no} — {c.baslik.toLocaleUpperCase("tr-TR")}
          </h3>
          {c.paragraflar.map((p, i) => (
            <p key={i} className="mb-1.5 text-justify">{p}</p>
          ))}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-6 mt-10">
        {sigs.map((s) => (
          <div key={s.rol}>
            <p className="font-bold mb-10">{s.rol}</p>
            <p className="border-t border-black pt-1">{s.isim || " "}</p>
            <p className="text-[10px] text-neutral-500 mt-1">Kaşe / İmza</p>
          </div>
        ))}
      </div>
      <div className="mt-8 border-t border-neutral-400 pt-2 text-[10px] text-neutral-600">
        <p className="mb-0.5">{LAWYER_NOTE_BOTTOM}</p>
        <p>{BRAND_LINE}</p>
      </div>
    </div>
  );
}

export default function RehberSozlesmesi() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ContractData>(INITIAL_DATA);
  const [tab, setTab] = useState<"form" | "onizleme">("form");
  const [busy, setBusy] = useState(false);

  const cta = ctaTexts("tr");
  const faqSchema = useMemo(() => buildFaqSchema(extractFaq(ARTICLE_MD)), []);
  const eksik = missingRequired(data);
  const hazir = eksik.length === 0;

  useEffect(() => { setMounted(true); }, []);

  // Görüntüleme event'i (üçlünün 1'i) — yalnız araç sayfası açıldığında
  useEffect(() => { trackToolEvent("view", { tool: TOOL.id }); }, []);

  // Yenileme-kaybı yumuşatması: depolama YOK, tarayıcının yerleşik uyarısı
  useEffect(() => {
    if (!isDirty(data)) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [data]);

  const set = <K extends keyof ContractData>(k: K, v: ContractData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const setExpense = (k: ExpenseKey, v: ExpenseOwner) =>
    setData((d) => ({ ...d, masraflar: { ...d.masraflar, [k]: v } }));

  const toggleLang = (l: string) =>
    setData((d) => ({ ...d, diller: d.diller.includes(l) ? d.diller.filter((x) => x !== l) : [...d.diller, l] }));

  // Belge üretimi — TIKLAMADA lazy import (bundle'a girmez)
  const doExport = async (kind: "doc" | "pdf" | "draft") => {
    setBusy(true);
    try {
      const mod = await import("@/lib/tools/rehber-sozlesmesi/export");
      if (kind === "doc") { mod.downloadDoc(data); trackToolEvent("download", { tool: TOOL.id, format: "doc" }); }
      else if (kind === "pdf") { trackToolEvent("download", { tool: TOOL.id, format: "pdf" }); mod.printDocument(); }
      else { mod.downloadDraft(data); }
    } finally { setBusy(false); }
  };

  const loadDraft = (file: File) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = JSON.parse(String(fr.result));
        setData({ ...INITIAL_DATA, ...parsed, masraflar: { ...INITIAL_DATA.masraflar, ...(parsed.masraflar || {}) } });
      } catch { /* bozuk dosya — sessizce yoksay, form korunur */ }
    };
    fr.readAsText(file);
  };

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        "name": "Rehber sözleşmesi nasıl oluşturulur?",
        "description": PAGE_DESC,
        "step": [
          { "@type": "HowToStep", "name": "Taraf bilgilerini girin" },
          { "@type": "HowToStep", "name": "Tur, tarih ve ücret bilgilerini doldurun" },
          { "@type": "HowToStep", "name": "Önizlemeyi kontrol edip Word veya PDF olarak indirin" },
        ],
      },
      ...(faqSchema ? [faqSchema] : []),
    ],
  };

  return (
    <Layout>
      <SEOHead
        title={PAGE_TITLE}
        description={PAGE_DESC}
        keywords="rehber sözleşmesi, tur rehberi sözleşme örneği, acente rehber sözleşmesi şablon, rehberlik hizmet sözleşmesi"
        canonical={TOOL.path.tr}
        schema={schema}
      />

      {/* ── Statik iskelet (prerender) ─────────────────────────────────── */}
      <section className="py-10 bg-gradient-to-b from-orange-50/30 to-background dark:from-orange-950/10 no-print">
        <div className="container mx-auto px-4 max-w-5xl">
          <nav className="text-sm text-muted-foreground mb-3">
            <Link to="/araclar" className="hover:text-orange-500">Araçlar</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Rehber Sözleşmesi Oluşturucu</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Rehber Sözleşmesi Oluşturucu</h1>
          <p className="text-muted-foreground max-w-3xl">
            Acente ile tur rehberi arasındaki hizmet sözleşmesinin <strong>örnek iskeletini</strong> formu doldurarak
            oluşturun; Word olarak indirip düzenleyin veya PDF olarak kaydedin. Boş bıraktığınız opsiyonel alanların
            maddeleri belgeden düşer — köşeli parantezli taslak üretilmez.
          </p>
          <p className="mt-4 inline-flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 text-orange-500 shrink-0" aria-hidden="true" />
            <span>
              <strong className="text-foreground">Bilgileriniz cihazınızdan çıkmaz.</strong> Bu araç girdiğiniz hiçbir
              veriyi sunucuya göndermez ve kaydetmez; belge tamamen tarayıcınızda oluşturulur. Bunun karşılığı olarak
              sayfayı yenilerseniz form sıfırlanır.
            </span>
          </p>
        </div>
      </section>

      {/* ── Form + canlı önizleme (client-mount) ───────────────────────── */}
      <section className="container mx-auto px-4 max-w-5xl py-8">
        {!mounted ? (
          <div className="min-h-[560px] rounded-xl border border-border bg-muted/20 flex items-center justify-center no-print">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Mobil sekme çubuğu */}
            <div className="lg:hidden grid grid-cols-2 gap-2 mb-5 no-print">
              <Button variant={tab === "form" ? "default" : "outline"} size="sm"
                className={tab === "form" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                onClick={() => setTab("form")}>Form</Button>
              <Button variant={tab === "onizleme" ? "default" : "outline"} size="sm"
                className={tab === "onizleme" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                onClick={() => setTab("onizleme")}>Önizleme</Button>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* FORM */}
              <div className={`${tab === "form" ? "block" : "hidden"} lg:block no-print`}>
                <SectionTitle>1. Taraflar</SectionTitle>
                <div className="space-y-4">
                  <Field label="Acente unvanı" required>
                    <Input value={data.acenteUnvan} onChange={(e) => set("acenteUnvan", e.target.value)} placeholder="Örn. Aymila Turizm Seyahat Acentesi" />
                  </Field>
                  <Field label="Acente adresi" required>
                    <Textarea rows={2} value={data.acenteAdres} onChange={(e) => set("acenteAdres", e.target.value)} />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Vergi dairesi / numarası"><Input value={data.acenteVergi} onChange={(e) => set("acenteVergi", e.target.value)} /></Field>
                    <Field label="TÜRSAB belge numarası"><Input value={data.acenteTursab} onChange={(e) => set("acenteTursab", e.target.value)} /></Field>
                  </div>
                  <Field label="Acente yetkilisi" required>
                    <Input value={data.acenteYetkili} onChange={(e) => set("acenteYetkili", e.target.value)} />
                  </Field>
                  <Field label="Rehber ad-soyad" required>
                    <Input value={data.rehberAd} onChange={(e) => set("rehberAd", e.target.value)} />
                  </Field>
                  <Field label="Ruhsat / çalışma kartı numarası" hint="Boş bırakırsanız belge bu bilgiye hiç değinmez.">
                    <Input value={data.rehberKartNo} onChange={(e) => set("rehberKartNo", e.target.value)} />
                  </Field>
                  <Field label="Rehber adresi" required>
                    <Textarea rows={2} value={data.rehberAdres} onChange={(e) => set("rehberAdres", e.target.value)} />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Rehber telefonu"><Input value={data.rehberTelefon} onChange={(e) => set("rehberTelefon", e.target.value)} /></Field>
                    <Field label="Rehber IBAN" hint="Yazarsanız ödeme maddesinde anılır."><Input value={data.rehberIban} onChange={(e) => set("rehberIban", e.target.value)} /></Field>
                  </div>
                </div>

                <SectionTitle>2. İş tanımı</SectionTitle>
                <div className="space-y-4">
                  <Field label="Tur adı" required><Input value={data.turAdi} onChange={(e) => set("turAdi", e.target.value)} placeholder="Örn. Kapadokya 2 Gece 3 Gün Kültür Turu" /></Field>
                  <Field label="Güzergâh / kapsam"><Textarea rows={2} value={data.guzergah} onChange={(e) => set("guzergah", e.target.value)} /></Field>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Başlangıç tarihi" required><Input type="date" value={data.baslangicTarihi} onChange={(e) => set("baslangicTarihi", e.target.value)} /></Field>
                    <Field label="Bitiş tarihi" required><Input type="date" value={data.bitisTarihi} onChange={(e) => set("bitisTarihi", e.target.value)} /></Field>
                  </div>
                  <div>
                    <Label className="text-sm">Rehberlik dili <span className="text-orange-500">*</span></Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {GUIDE_LANGUAGES.map((l) => (
                        <button key={l} type="button" onClick={() => toggleLang(l)}
                          className={`text-xs rounded-full border px-3 py-1.5 transition-colors ${data.diller.includes(l) ? "bg-orange-500 border-orange-500 text-white" : "border-border hover:border-orange-300"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Günlük çalışma düzeni" hint="Örn. günlük 8 saat"><Input value={data.calismaSuresi} onChange={(e) => set("calismaSuresi", e.target.value)} /></Field>
                    <Field label="Tahmini grup büyüklüğü"><Input value={data.grupBuyuklugu} onChange={(e) => set("grupBuyuklugu", e.target.value)} /></Field>
                  </div>
                </div>

                <SectionTitle>3. Ücret ve ödeme</SectionTitle>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Ücret" required><Input value={data.ucretTutar} onChange={(e) => set("ucretTutar", e.target.value)} placeholder="7500" /></Field>
                    <Field label="Para birimi" required>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={data.ucretParaBirimi} onChange={(e) => set("ucretParaBirimi", e.target.value as any)}>
                        <option value="TRY">TL</option><option value="EUR">EUR</option><option value="USD">USD</option>
                      </select>
                    </Field>
                    <Field label="Hesaplama" required>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={data.ucretBazi} onChange={(e) => set("ucretBazi", e.target.value as any)}>
                        <option value="tur">Tur başına</option><option value="gun">Gün başına</option><option value="saat">Saat başına</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Ödeme zamanı" required>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={data.odemeZamani} onChange={(e) => set("odemeZamani", e.target.value as any)}>
                        <option value="tur_sonu">Tur sonrası</option><option value="pesin">Peşin</option><option value="kismi">Kısmi (başta + sonra)</option>
                      </select>
                    </Field>
                    <Field label="Gün sayısı" hint="Tur sonrası/kısmi için"><Input value={data.odemeGun} onChange={(e) => set("odemeGun", e.target.value)} /></Field>
                    <Field label="Ödeme yöntemi">
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={data.odemeYontemi} onChange={(e) => set("odemeYontemi", e.target.value as any)}>
                        <option value="banka">Banka</option><option value="nakit">Nakit</option><option value="">Belirtilmesin</option>
                      </select>
                    </Field>
                  </div>
                  <div>
                    <Label className="text-sm">Masraf kalemleri <span className="text-muted-foreground text-xs">(hiçbiri seçilmezse masraf maddesi belgeye girmez)</span></Label>
                    <div className="mt-2 space-y-2">
                      {EXPENSE_ITEMS.map((it) => (
                        <div key={it.key} className="flex items-center justify-between gap-3 text-sm">
                          <span>{it.label}</span>
                          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={data.masraflar[it.key]} onChange={(e) => setExpense(it.key, e.target.value as ExpenseOwner)}>
                            <option value="">—</option><option value="acente">Acente</option><option value="rehber">Rehber</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <SectionTitle>4. İptal koşulları</SectionTitle>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Acente iptalinde bildirim süresi (gün)"><Input value={data.acenteIptalGun} onChange={(e) => set("acenteIptalGun", e.target.value)} /></Field>
                    <Field label="Bu durumda ücret">
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={data.acenteIptalUcret} onChange={(e) => set("acenteIptalUcret", e.target.value as any)}>
                        <option value="">Belirtilmesin</option><option value="tam">Tamamı ödenir</option><option value="kismi">Kısmen ödenir</option><option value="yok">Ödenmez</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Rehber iptalinde bildirim süresi (gün)"><Input value={data.rehberIptalGun} onChange={(e) => set("rehberIptalGun", e.target.value)} /></Field>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={data.rehberIkame} onCheckedChange={(v) => set("rehberIkame", !!v)} />
                        Rehber ikame bulmaya çalışır
                      </label>
                    </div>
                  </div>
                </div>

                <SectionTitle>5. Diğer maddeler</SectionTitle>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={data.mucbirSebep} onCheckedChange={(v) => set("mucbirSebep", !!v)} /> Mücbir sebep maddesi eklensin
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={data.yururlukFesih} onCheckedChange={(v) => set("yururlukFesih", !!v)} /> Yürürlük ve fesih maddesi eklensin
                  </label>
                  {data.yururlukFesih && (
                    <Field label="Fesih bildirim süresi (gün)" hint="Boş bırakılırsa 'yazılı bildirimle' ifadesi kullanılır.">
                      <Input value={data.fesihBildirimGun} onChange={(e) => set("fesihBildirimGun", e.target.value)} />
                    </Field>
                  )}
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={data.gizlilik} onCheckedChange={(v) => set("gizlilik", !!v)} /> Gizlilik ve kişisel veri maddesi eklensin
                  </label>
                  <Field label="Uyuşmazlıkta yetkili yer" hint="Boş bırakılırsa bu madde belgeye girmez.">
                    <Input value={data.yetkiliYer} onChange={(e) => set("yetkiliYer", e.target.value)} placeholder="Örn. İstanbul" />
                  </Field>
                  <Field label="Ek koşullar" hint="Boş bırakılırsa bu madde belgeye girmez.">
                    <Textarea rows={3} value={data.ekKosullar} onChange={(e) => set("ekKosullar", e.target.value)} />
                  </Field>
                </div>

                <SectionTitle>6. Belge bilgileri</SectionTitle>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Düzenleme yeri"><Input value={data.duzenlemeYeri} onChange={(e) => set("duzenlemeYeri", e.target.value)} /></Field>
                  <Field label="Düzenleme tarihi"><Input type="date" value={data.duzenlemeTarihi} onChange={(e) => set("duzenlemeTarihi", e.target.value)} /></Field>
                  <Field label="Nüsha sayısı"><Input value={data.nushaSayisi} onChange={(e) => set("nushaSayisi", e.target.value)} /></Field>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => doExport("draft")} disabled={busy}>
                    <Download className="w-4 h-4 mr-1.5" /> Taslağı indir
                  </Button>
                  <label className="inline-flex">
                    <input type="file" accept="application/json,.json" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) loadDraft(f); e.currentTarget.value = ""; }} />
                    <span className="inline-flex items-center h-9 px-3 rounded-md border border-input text-sm cursor-pointer hover:bg-accent">
                      <Upload className="w-4 h-4 mr-1.5" /> Taslak yükle
                    </span>
                  </label>
                </div>
              </div>

              {/* ÖNİZLEME */}
              <div className={`${tab === "onizleme" ? "block" : "hidden"} lg:block`}>
                <div className="lg:sticky lg:top-24">
                  <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
                    <Button size="sm" disabled={!hazir || busy} onClick={() => doExport("doc")}
                      className="bg-orange-500 hover:bg-orange-600 text-white">
                      <FileText className="w-4 h-4 mr-1.5" /> Word olarak indir
                    </Button>
                    <Button size="sm" variant="outline" disabled={!hazir || busy} onClick={() => doExport("pdf")}>
                      <Printer className="w-4 h-4 mr-1.5" /> PDF olarak indir
                    </Button>
                  </div>
                  {!hazir && (
                    <p className="mb-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 no-print inline-flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>İndirme için eksik alanlar: {eksik.join(", ")}</span>
                    </p>
                  )}
                  <div className="max-h-[75vh] overflow-y-auto rounded-lg print-area">
                    <DocumentPreview data={data} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Kardeş makale + SSS (statik, SEO yüzeyi) ───────────────────── */}
      <section className="container mx-auto px-4 max-w-3xl py-10 no-print">
        <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{ARTICLE_MD}</ReactMarkdown>
        </article>
      </section>

      {/* ── CTA (blog tek-kaynağı) ─────────────────────────────────────── */}
      <section className="py-12 bg-muted/30 no-print">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">{cta.endTitle}</h2>
          <p className="text-muted-foreground mb-5">{cta.endDesc}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => trackToolEvent("cta", { tool: TOOL.id, target: "whatsapp" })}>
              <a href={DEMO_WA_URL} target="_blank" rel="noopener noreferrer">{cta.endBtn}</a>
            </Button>
            <Button asChild variant="outline"
              onClick={() => trackToolEvent("cta", { tool: TOOL.id, target: "signup" })}>
              <Link to={SIGNUP_URL}>{cta.endSecondary}</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
