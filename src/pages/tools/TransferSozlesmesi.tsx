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
import { Bus, Printer, ShieldCheck, Download, Upload, AlertCircle, Plus, X } from "lucide-react";
import { extractFaq, buildFaqSchema, ctaTexts, DEMO_WA_URL, SIGNUP_URL } from "@/lib/blog-anatomy";
import { trackToolEvent } from "@/components/MetaPixel";
import { TOOLS } from "@/lib/tools/registry";
import { ARTICLE_MD } from "@/lib/tools/transfer-sozlesmesi/article";
import {
  INITIAL_TRANSFER, COST_ITEMS, FEE_BASIS_LABEL, feeBasisOptions, defaultFeeBasis,
  missingRequired, isDirty, newId,
  type TransferData, type WorkMode, type CostKey, type CostOwner,
} from "@/lib/tools/transfer-sozlesmesi/schema";
import { transferSpec } from "@/lib/tools/transfer-sozlesmesi/clauses";
import type { DocSpec } from "@/lib/tools/docx";

// ARAÇ-6 / Transfer & Araç Kiralama Sözleşmesi.
// İKİ MOD (tek-sefer ↔ dönem): mod tarih alanlarını, bedel bazını ve fesih
// maddesini BİRLİKTE değiştirir — iki mod aynı belgede karışmaz.
// Belgenin özü ikame-araç maddesi (M4-#7'nin yazılı karşılığı).
// PRERENDER: iskelet statik; form client-mount. Belge modülü tıklamada lazy.

const TOOL = TOOLS.find((t) => t.id === "transfer-sozlesmesi")!;
const PAGE_TITLE = "Transfer ve Araç Kiralama Sözleşmesi Oluşturucu (Ücretsiz)";
const PAGE_DESC =
  "Acente ile otobüs/transfer firması arasındaki taşıma sözleşmesinin örnek iskeletini formdan üretin — ikame araç yükümlülüğü dahil. Word veya PDF, kayıt yok, veriler cihazınızdan çıkmaz.";

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

function DocPreview({ spec }: { spec: DocSpec }) {
  return (
    <div id="sozlesme-onizleme" className="doc-preview bg-white text-black rounded-lg border border-border p-6 md:p-8 text-[13px] leading-relaxed">
      <h2 className="text-center font-bold text-base mb-1">{spec.baslik}</h2>
      <p className="text-center italic text-[11px] text-neutral-600 mb-5">{spec.ustNot}</p>
      {spec.bolumler.map((s, i) => (
        <div key={i} className="mb-4">
          <h3 className="font-bold text-[13px] mb-1.5">MADDE {s.no} — {s.baslik.toLocaleUpperCase("tr-TR")}</h3>
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

export default function TransferSozlesmesi() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"form" | "belge">("form");
  const [data, setData] = useState<TransferData>(INITIAL_TRANSFER);

  const faq = useMemo(() => extractFaq(ARTICLE_MD), []);
  const faqSchema = useMemo(() => buildFaqSchema(faq), [faq]);
  const cta = ctaTexts("tr");
  const eksik = missingRequired(data);

  useEffect(() => { setMounted(true); trackToolEvent("view", { tool: TOOL.id }); }, []);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (isDirty(data)) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [data]);

  const set = <K extends keyof TransferData>(k: K, v: TransferData[K]) => setData((p) => ({ ...p, [k]: v }));

  /** Mod değişince bedel bazı da anlamlı olana çekilir */
  const setMod = (m: WorkMode) => setData((p) => ({ ...p, mod: m, bedelBazi: defaultFeeBasis(m) }));

  const setMasraf = (k: CostKey, v: CostOwner) =>
    setData((p) => ({ ...p, masraflar: { ...p.masraflar, [k]: p.masraflar[k] === v ? "" : v } }));

  const runExport = async (kind: "doc" | "pdf" | "taslak-indir" | "taslak-yukle", file?: File) => {
    const mod = await import("@/lib/tools/transfer-sozlesmesi/export");
    if (kind === "doc") { mod.downloadContract(data); trackToolEvent("download", { tool: TOOL.id, format: "doc" }); }
    else if (kind === "pdf") { trackToolEvent("download", { tool: TOOL.id, format: "pdf" }); mod.printDocument(); }
    else if (kind === "taslak-indir") mod.downloadDraft(data);
    else if (kind === "taslak-yukle" && file) {
      const text = await file.text();
      try { setData({ ...INITIAL_TRANSFER, ...JSON.parse(text) }); } catch { /* bozuk taslak yok sayılır */ }
    }
  };

  return (
    <Layout>
      <SEOHead title={PAGE_TITLE} description={PAGE_DESC} canonical={TOOL.path.tr} schema={faqSchema} />

      <section className="py-10 bg-gradient-to-b from-orange-50/30 to-background dark:from-orange-950/10 no-print">
        <div className="container mx-auto px-4 max-w-6xl">
          <nav className="text-xs text-muted-foreground mb-3">
            <Link to="/araclar" className="hover:text-primary">Araçlar</Link>
            <span className="mx-1.5">/</span><span>Transfer ve Araç Kiralama Sözleşmesi</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-bold mb-3 flex items-start gap-2.5">
            <Bus className="h-7 w-7 text-orange-500 shrink-0 mt-0.5" />
            Transfer ve Araç Kiralama Sözleşmesi Oluşturucu
          </h1>
          <p className="text-muted-foreground max-w-3xl">{PAGE_DESC}</p>
          <p className="mt-3 inline-flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-px" />
            Bilgileriniz sunucumuza gönderilmez; belge tamamen tarayıcınızda oluşturulur.
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
              <Button variant={tab === "belge" ? "default" : "outline"} size="sm" onClick={() => setTab("belge")}>Sözleşme</Button>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* FORM */}
              <div className={`${tab === "form" ? "block" : "hidden"} lg:block no-print`}>
                <SectionTitle>Çalışma biçimi</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" variant={data.mod === "tek-sefer" ? "default" : "outline"} onClick={() => setMod("tek-sefer")}>
                    Tek sefer
                  </Button>
                  <Button type="button" size="sm" variant={data.mod === "donem" ? "default" : "outline"} onClick={() => setMod("donem")}>
                    Sezonluk dönem
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {data.mod === "tek-sefer"
                    ? "Tek bir sefer için sözleşme. Tarih ve saat alanları buna göre gelir."
                    : "Dönem boyunca sefer programına göre çalışma. Fesih bildirimi maddesi eklenir."}
                </p>

                <SectionTitle>Acente</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Acente unvanı" required><Input value={data.acenteUnvan} onChange={(e) => set("acenteUnvan", e.target.value)} /></Field>
                  <Field label="TÜRSAB belge no"><Input value={data.acenteTursab} onChange={(e) => set("acenteTursab", e.target.value)} /></Field>
                  <Field label="Telefon"><Input value={data.acenteTelefon} onChange={(e) => set("acenteTelefon", e.target.value)} /></Field>
                  <Field label="Adres"><Input value={data.acenteAdres} onChange={(e) => set("acenteAdres", e.target.value)} /></Field>
                  <Field label="Yetkili kişi"><Input value={data.acenteYetkili} onChange={(e) => set("acenteYetkili", e.target.value)} /></Field>
                </div>

                <SectionTitle>Taşıyıcı</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Unvan / ad" required><Input value={data.tasiyiciUnvan} onChange={(e) => set("tasiyiciUnvan", e.target.value)} /></Field>
                  <Field label="Yetki belgesi no" hint="D2 / turizm taşımacılığı — boşsa belgeye girmez">
                    <Input value={data.tasiyiciYetkiBelge} onChange={(e) => set("tasiyiciYetkiBelge", e.target.value)} />
                  </Field>
                  <Field label="Telefon"><Input value={data.tasiyiciTelefon} onChange={(e) => set("tasiyiciTelefon", e.target.value)} /></Field>
                  <Field label="Adres"><Input value={data.tasiyiciAdres} onChange={(e) => set("tasiyiciAdres", e.target.value)} /></Field>
                </div>

                <div className="mt-5">
                  <Label className="text-sm">Araçlar <span className="text-muted-foreground text-xs">(boşsa madde belgeye girmez)</span></Label>
                  <div className="space-y-2 mt-2">
                    {data.araclar.map((v, i) => (
                      <div key={v.id} className="grid grid-cols-[1.4fr_1fr_0.7fr_auto] gap-2 items-end">
                        {i === 0 && <><Label className="text-xs text-muted-foreground col-start-1">Araç tipi</Label></>}
                        <Input value={v.tip} placeholder="45 kişilik otobüs"
                          onChange={(e) => { const n = [...data.araclar]; n[i] = { ...v, tip: e.target.value }; set("araclar", n); }} />
                        <Input value={v.plaka} placeholder="Plaka"
                          onChange={(e) => { const n = [...data.araclar]; n[i] = { ...v, plaka: e.target.value }; set("araclar", n); }} />
                        <Input value={v.koltuk} placeholder="Koltuk" inputMode="numeric"
                          onChange={(e) => { const n = [...data.araclar]; n[i] = { ...v, koltuk: e.target.value }; set("araclar", n); }} />
                        <Button type="button" variant="ghost" size="icon" aria-label="Aracı sil"
                          onClick={() => set("araclar", data.araclar.filter((x) => x.id !== v.id))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => set("araclar", [...data.araclar, { id: newId("v"), tip: "", plaka: "", koltuk: "" }])}>
                      <Plus className="h-3.5 w-3.5 me-1" /> Araç ekle
                    </Button>
                  </div>
                </div>

                <div className="mt-5">
                  <Label className="text-sm">Şoförler <span className="text-muted-foreground text-xs">(opsiyonel — T.C. kimlik istemiyoruz)</span></Label>
                  <div className="space-y-2 mt-2">
                    {data.soforler.map((s, i) => (
                      <div key={s.id} className="grid grid-cols-[1.4fr_1fr_auto] gap-2 items-end">
                        <Input value={s.ad} placeholder="Ad soyad"
                          onChange={(e) => { const n = [...data.soforler]; n[i] = { ...s, ad: e.target.value }; set("soforler", n); }} />
                        <Input value={s.telefon} placeholder="Telefon"
                          onChange={(e) => { const n = [...data.soforler]; n[i] = { ...s, telefon: e.target.value }; set("soforler", n); }} />
                        <Button type="button" variant="ghost" size="icon" aria-label="Şoförü sil"
                          onClick={() => set("soforler", data.soforler.filter((x) => x.id !== s.id))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => set("soforler", [...data.soforler, { id: newId("s"), ad: "", telefon: "" }])}>
                      <Plus className="h-3.5 w-3.5 me-1" /> Şoför ekle
                    </Button>
                  </div>
                </div>

                <SectionTitle>İş bilgileri</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="İş / güzergâh adı" required><Input value={data.isAdi} onChange={(e) => set("isAdi", e.target.value)} placeholder="ör. Kapadokya günübirlik transfer" /></Field>
                  <Field label="Güzergâh ayrıntısı"><Input value={data.guzergah} onChange={(e) => set("guzergah", e.target.value)} /></Field>
                </div>

                {data.mod === "tek-sefer" ? (
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <Field label="Sefer tarihi" required><Input type="date" value={data.seferTarihi} onChange={(e) => set("seferTarihi", e.target.value)} /></Field>
                    <Field label="Hareket saati"><Input value={data.seferSaati} onChange={(e) => set("seferSaati", e.target.value)} placeholder="07:00" /></Field>
                    <Field label="Buluşma noktası"><Input value={data.bulusmaNoktasi} onChange={(e) => set("bulusmaNoktasi", e.target.value)} /></Field>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <Field label="Dönem başlangıcı" required><Input type="date" value={data.donemBaslangic} onChange={(e) => set("donemBaslangic", e.target.value)} /></Field>
                    <Field label="Dönem bitişi"><Input type="date" value={data.donemBitis} onChange={(e) => set("donemBitis", e.target.value)} /></Field>
                    <Field label="Sefer günleri"><Input value={data.donemGunler} onChange={(e) => set("donemGunler", e.target.value)} placeholder="ör. hafta sonları" /></Field>
                  </div>
                )}

                <SectionTitle>Bedel ve masraflar</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Tutar" required><Input value={data.bedelTutar} onChange={(e) => set("bedelTutar", e.target.value)} /></Field>
                  <Field label="Para birimi"><Input value={data.paraBirimi} onChange={(e) => set("paraBirimi", e.target.value)} /></Field>
                </div>
                <div className="mt-4 space-y-1.5">
                  <Label className="text-sm">Hesaplama biçimi</Label>
                  <div className="flex flex-wrap gap-2">
                    {feeBasisOptions(data.mod).map((b) => (
                      <Button key={b} type="button" size="sm" variant={data.bedelBazi === b ? "default" : "outline"} onClick={() => set("bedelBazi", b)}>
                        {FEE_BASIS_LABEL[b]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label className="text-sm">Masraflar kime ait?</Label>
                  <p className="text-xs text-muted-foreground">
                    İşaretlemediğiniz kalem belgeye hiç girmez. Yazılmayan masraf, sahada tartışma üretir.
                  </p>
                  {COST_ITEMS.map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-2 bg-muted/30 rounded px-2.5 py-1.5">
                      <span className="text-sm">{c.label}</span>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant={data.masraflar[c.key] === "acente" ? "default" : "outline"}
                          onClick={() => setMasraf(c.key, "acente")}>Acente</Button>
                        <Button type="button" size="sm" variant={data.masraflar[c.key] === "tasiyici" ? "default" : "outline"}
                          onClick={() => setMasraf(c.key, "tasiyici")}>Taşıyıcı</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Field label="Ödeme vadesi"><Input value={data.odemeVadesi} onChange={(e) => set("odemeVadesi", e.target.value)} placeholder="ör. sefer sonrası 7 gün içinde" /></Field>
                </div>

                <SectionTitle>Koşullar</SectionTitle>
                <div className="rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50/60 dark:bg-orange-950/30 p-3 mb-4">
                  <p className="text-xs font-medium text-orange-900 dark:text-orange-200 mb-2">
                    İkame araç maddesi bu belgenin özüdür — arıza günü ne olacağı burada yazılır.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="İkame araç temin süresi (saat)" hint="Boşsa 'en kısa süre' ifadesi kullanılır">
                      <Input value={data.ikameSure} onChange={(e) => set("ikameSure", e.target.value)} placeholder="2" inputMode="numeric" />
                    </Field>
                    <label className="flex items-start gap-2 text-sm cursor-pointer pt-6">
                      <Checkbox checked={data.ikameKapasite} onCheckedChange={(v) => set("ikameKapasite", v === true)} />
                      <span>İkame araç eşdeğer kapasitede olmalı</span>
                    </label>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Gecikme/iptal bildirim süresi (saat)"><Input value={data.bildirimSaat} onChange={(e) => set("bildirimSaat", e.target.value)} inputMode="numeric" /></Field>
                  {data.mod === "donem" && (
                    <Field label="Fesih bildirim süresi (gün)"><Input value={data.fesihGun} onChange={(e) => set("fesihGun", e.target.value)} inputMode="numeric" /></Field>
                  )}
                </div>
                <label className="flex items-start gap-2 mt-4 text-sm cursor-pointer">
                  <Checkbox checked={data.sigortaBeyani} onCheckedChange={(v) => set("sigortaBeyani", v === true)} />
                  <span>Taşıyıcı, zorunlu sigortaların geçerli olduğunu beyan eder</span>
                </label>

                <SectionTitle>Tarih ve ek koşullar</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Sözleşme tarihi"><Input type="date" value={data.sozlesmeTarihi} onChange={(e) => set("sozlesmeTarihi", e.target.value)} /></Field>
                  <Field label="Düzenleme yeri"><Input value={data.duzenlemeYeri} onChange={(e) => set("duzenlemeYeri", e.target.value)} /></Field>
                </div>
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

              {/* ÖNİZLEME */}
              <div className={`${tab === "belge" ? "block" : "hidden"} lg:block`}>
                <div className="lg:sticky lg:top-24">
                  <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
                    <Button size="sm" variant="outline" onClick={() => runExport("doc")}>
                      <Download className="h-4 w-4 me-1.5" /> Word olarak indir
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runExport("pdf")}>
                      <Printer className="h-4 w-4 me-1.5" /> PDF olarak indir
                    </Button>
                  </div>
                  {eksik.length > 0 && (
                    <p className="mb-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 no-print inline-flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-px" /> Eksik alanlar: {eksik.join(", ")}
                    </p>
                  )}
                  <div className="max-h-[75vh] overflow-y-auto rounded-lg print-area">
                    <DocPreview spec={transferSpec(data)} />
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
