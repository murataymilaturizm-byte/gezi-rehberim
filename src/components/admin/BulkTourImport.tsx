import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Loader2, Info, Languages } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { normalizeRow, COLUMN_ORDER } from "@/utils/excelColumnDictionary";
import { cn } from "@/lib/utils";
import i18next from "i18next";

// ETAP 1.5b: AI çeviri çağrısında concurrency=3 paralelleştirme.
// Anthropic Sonnet 4.5 standart tier rate-limit'i için muhafazakar tavan.
const TRANSLATE_CONCURRENCY = 3;
// 100 tur tavanı: 100 × ~$0.0155 = $1.55 — kabul edilebilir. Üstündeyse checkbox disable.
const TRANSLATE_MAX_ROWS = 100;
const TRANSLATE_RETRY = 1; // AI fail durumunda 1 retry
const SOURCE_LANG = "tr";

/**
 * Standalone şablon indirme fonksiyonu — Admin.tsx toolbar'ından doğrudan çağrılabilsin diye
 * dialog dışına çıkarıldı. Mantık DEĞİŞMEDİ: 20 kolon master + Talimatlar sheet'i.
 * i18next.t kullanılır (hook yok — pure function).
 */
export function downloadTourImportTemplate(): void {
  const _SYSTEM_KEYS = new Set(["__tour_id", "created_at"]);
  const _TR: Record<string, string> = {
    title: "Tur Adı", destination: "Destinasyon", type: "Tip", currency: "Para Birimi",
    min_pax: "Min. Kişi", visa_required: "Vize Gerekli", program_url: "Program URL",
    program_kisa: "Kısa Program", hareket_noktasi: "Hareket Noktası",
    toplanma_saati: "Toplanma Saati", tur_sure: "Tur Süresi", tur_kategorisi: "Tur Kategorisi",
    gezilecek_yerler: "Gezilecek Yerler", ulasim: "Ulaşım", konaklama: "Konaklama",
    hotel_name: "Otel Adı", hotel_stars: "Otel Yıldızı", visa_notes: "Vize Notları",
  };
  const _h = (tech: string): string => {
    if (_SYSTEM_KEYS.has(tech)) return tech;
    return i18next.t(`bulk.col.${tech}`, { defaultValue: _TR[tech] ?? tech });
  };
  // ETAP 1.5b: 18 çok dilli kolon ŞABLONDAN çıkarılmış. Etap 1.5b AI checkbox bunları doldurur.
  const _MULTI_LANG = /^(title|destination|program_kisa)_(en|de|fr|es|ru|ar)$/;
  const _TEMPLATE_ORDER = COLUMN_ORDER.filter((c) => !_MULTI_LANG.test(c));
  const _row = (vals: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const tech of _TEMPLATE_ORDER) {
      out[_h(tech)] = vals[tech] ?? "";
    }
    return out;
  };

  const template = [
    _row({
      title: "Kapadokya Balon Turu",
      destination: "Kapadokya",
      type: "DAYTRIP",
      currency: "TRY",
      min_pax: 2,
      visa_required: "hayır",
      program_kisa: "Sabah 04:30 otelden alış, balon uçuşu (1 saat), kahvaltı, otel transferi",
      hareket_noktasi: "Otel lobi",
      toplanma_saati: "04:30",
      tur_sure: "1 gün",
      tur_kategorisi: "Macera",
      gezilecek_yerler: "Göreme Vadisi, Peri Bacaları, Uçhisar Kalesi",
      ulasim: "Otobüs / VIP araç",
    }),
    _row({
      title: "İstanbul 2 Gece Klasik Tur",
      destination: "İstanbul",
      type: "N2",
      currency: "USD",
      min_pax: 1,
      visa_required: "hayır",
      program_kisa: "1. gün: Sultanahmet, Aya Sofya. 2. gün: Topkapı, Kapalı Çarşı. 3. gün: Boğaz turu, transfer",
      hareket_noktasi: "Havaalanı transfer dahil",
      toplanma_saati: "10:00",
      tur_sure: "2 gece 3 gün",
      tur_kategorisi: "Kültür",
      gezilecek_yerler: "Sultanahmet Camii, Aya Sofya, Topkapı Sarayı, Kapalı Çarşı, Boğaz turu",
      ulasim: "Klimalı otobüs + tekne (boğaz turu)",
      konaklama: "2 gece çift kişilik oda + kahvaltı",
      hotel_name: "Hotel Sultanahmet Palace",
      hotel_stars: 4,
    }),
    _row({
      title: "Pamukkale Günübirlik",
      destination: "Pamukkale",
      type: "DAYTRIP",
      currency: "TRY",
    }),
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  ws["!cols"] = [
    { wch: 38 }, { wch: 12 },
    { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
    { wch: 8 },  { wch: 10 }, { wch: 30 }, { wch: 60 },
    { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 40 }, { wch: 22 }, { wch: 30 }, { wch: 22 },
    { wch: 10 }, { wch: 30 },
  ];

  const _t = (key: string, opts?: any) => i18next.t(key, opts);
  const _req = _t("bulk.tpl.req", { defaultValue: "ZORUNLU" });
  const _opt = _t("bulk.tpl.opt", { defaultValue: "Opsiyonel" });
  const _ro = "🔒";
  const _info = "ℹ️";
  const instructions = [
    { Kolon: "__tour_id",      Tip: _ro,  Açıklama: _t("bulk.tpl.__tour_id", { defaultValue: "Sistem kimliği — DEĞİŞTİRMEYİN/SİLMEYİN. Mevcut turu güncellemek için gereklidir (Etap 2)." }), Örnek: "(otomatik)" },
    { Kolon: "created_at",     Tip: _ro,  Açıklama: _t("bulk.tpl.created_at", { defaultValue: "Tur oluşturma tarihi — sistem alanı, salt-okunur." }), Örnek: "2026-05-24" },
    { Kolon: "title",          Tip: _req, Açıklama: _t("bulk.tpl.title", { defaultValue: "Tur başlığı (Türkçe)" }), Örnek: "Kapadokya Balon Turu" },
    { Kolon: "destination",    Tip: _req, Açıklama: _t("bulk.tpl.destination", { defaultValue: "Şehir/bölge" }), Örnek: "Kapadokya" },
    { Kolon: "type",           Tip: _req, Açıklama: _t("bulk.tpl.type", { defaultValue: "Tur tipi: DAYTRIP (günübirlik), N2 (2 gece), N3 (3+ gece)" }), Örnek: "DAYTRIP" },
    { Kolon: "currency",       Tip: _req, Açıklama: _t("bulk.tpl.currency", { defaultValue: "Para birimi: TRY, USD, EUR, GBP, SAR, AED, RUB" }), Örnek: "TRY" },
    { Kolon: "min_pax",        Tip: _opt, Açıklama: _t("bulk.tpl.minPax", { defaultValue: "Minimum kişi sayısı (sayı)" }), Örnek: "2" },
    { Kolon: "visa_required",  Tip: _opt, Açıklama: _t("bulk.tpl.visa", { defaultValue: "Vize gerekli mi: evet / hayır" }), Örnek: "hayır" },
    { Kolon: "program_url",    Tip: _opt, Açıklama: _t("bulk.tpl.programUrl", { defaultValue: "Tur programı PDF/web linki (opsiyonel)" }), Örnek: "https://..." },
    { Kolon: "program_kisa",   Tip: _opt, Açıklama: _t("bulk.tpl.program", { defaultValue: "Tur programı/içeriği — botun müşteriye anlattığı kısa açıklama" }), Örnek: "Sabah 04:30 alış, balon uçuşu..." },
    { Kolon: "hareket_noktasi",Tip: _opt, Açıklama: _t("bulk.tpl.meetingPoint", { defaultValue: "Kalkış/buluşma yeri" }), Örnek: "Otel lobisi" },
    { Kolon: "toplanma_saati", Tip: _opt, Açıklama: _t("bulk.tpl.meetingTime", { defaultValue: "Saat — HH:MM formatı" }), Örnek: "09:00" },
    { Kolon: "tur_sure",       Tip: _opt, Açıklama: _t("bulk.tpl.duration", { defaultValue: "Tur süresi" }), Örnek: "1 gün / 2 gece 3 gün" },
    { Kolon: "tur_kategorisi", Tip: _opt, Açıklama: _t("bulk.tpl.category", { defaultValue: "Kültür / Doğa / Macera / Deniz vb." }), Örnek: "Macera" },
    { Kolon: "gezilecek_yerler",Tip: _opt, Açıklama: _t("bulk.tpl.places", { defaultValue: "Virgülle ayrılmış yer listesi" }), Örnek: "Göreme, Uçhisar, Peri Bacaları" },
    { Kolon: "ulasim",         Tip: _opt, Açıklama: _t("bulk.tpl.transport", { defaultValue: "Ulaşım şekli" }), Örnek: "Klimalı otobüs" },
    { Kolon: "konaklama",      Tip: _t("bulk.tpl.n23", { defaultValue: "N2/N3 önerilir" }), Açıklama: _t("bulk.tpl.accommodation", { defaultValue: "Konaklama açıklaması (oda tipi, yemek dahil mi)" }), Örnek: "2 gece çift kişilik oda + kahvaltı" },
    { Kolon: "hotel_name",     Tip: _opt, Açıklama: _t("bulk.tpl.hotelName", { defaultValue: "Otel adı (varsa)" }), Örnek: "Hotel Sultanahmet Palace" },
    { Kolon: "hotel_stars",    Tip: _opt, Açıklama: _t("bulk.tpl.hotelStars", { defaultValue: "Otel yıldızı (1-5 arası sayı)" }), Örnek: "4" },
    { Kolon: "visa_notes",     Tip: _opt, Açıklama: _t("bulk.tpl.visaNotes", { defaultValue: "Vize ile ilgili açıklama" }), Örnek: "Schengen vizesi şart" },
    { Kolon: "—", Tip: _info, Açıklama: _t("bulk.tpl.aiTranslateNotice", { defaultValue: "Çevirileri AI ile otomatik yapabilirsiniz — yükleme ekranındaki tiki işaretleyin. Acentenizin paketindeki dillere çevrilir." }), Örnek: "" },
    { Kolon: "—", Tip: _info, Açıklama: _t("bulk.tpl.dateNotice", { defaultValue: "Tur TARİHLERİ, FİYAT ve KONTENJAN bu Excel'de YOKTUR. Tarihleri panelden 'Toplu Tarih Oluştur' ile ekleyin." }), Örnek: "" },
  ];
  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 70 }, { wch: 50 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, _t("bulk.importSheetName"));
  XLSX.utils.book_append_sheet(
    wb,
    wsInstructions,
    _t("bulk.tpl.sheetInstructions", { defaultValue: "Talimatlar" }),
  );
  XLSX.writeFile(wb, `${_t("bulk.importFilename")}.xlsx`);
}

/** Basit promise pool — concurrency-limited paralel çalıştırma. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = await worker(items[idx], idx);
      } catch (err) {
        // Worker hataları yutulur; çağıran sayım yapsın
        results[idx] = undefined as any;
      }
      done++;
      onProgress?.(done, items.length);
    }
  });
  await Promise.all(workers);
  return results;
}

// ETAP 1: Excel master-only format. Tarih/fiyat/kontenjan (tour_dates) YOK.
// Export = Şablon = Import AYNI kolon yapısını paylaşır. TourFormDialog'un istediği
// tüm master alanlar + 18 çok dilli + __tour_id (sistem, salt-okunur) içerir.
interface ParsedTour {
  rowIndex: number;
  // Sistem (salt-okunur — Etap 1'de YOKSAYILIR, Etap 2'de UPSERT eşleşmesi için kullanılacak)
  __tour_id?: string;
  // Zorunlu
  title: string;
  destination: string;
  type: "DAYTRIP" | "N2" | "N3";
  currency: string;
  // Tur detayı (opsiyonel)
  program_url?: string;          // PDF/web link (TourFormDialog'da var)
  program_kisa?: string;
  ulasim?: string;             // ulaşım (otobüs/uçak/araba vb.)
  gezilecek_yerler?: string;   // virgüllü liste
  hareket_noktasi?: string;    // kalkış yeri
  toplanma_saati?: string;     // "09:00" gibi
  konaklama?: string;          // konaklama açıklaması (N2/N3 için)
  hotel_name?: string;
  hotel_stars?: number;        // 1-5
  tur_kategorisi?: string;     // kültür / doğa / macera vb.
  tur_sure?: string;           // "1 gün", "2 gece 3 gün"
  min_pax?: number;            // min kişi sayısı
  visa_required?: boolean;
  visa_notes?: string;
  // Çok dilli başlık
  title_en?: string;
  title_de?: string;
  title_fr?: string;
  title_es?: string;
  title_ru?: string;
  title_ar?: string;
  // Çok dilli destinasyon (yurtdışı/çok dilli pazar için)
  destination_en?: string;
  destination_de?: string;
  destination_fr?: string;
  destination_es?: string;
  destination_ru?: string;
  destination_ar?: string;
  // Çok dilli program özeti
  program_kisa_en?: string;
  program_kisa_de?: string;
  program_kisa_fr?: string;
  program_kisa_es?: string;
  program_kisa_ru?: string;
  program_kisa_ar?: string;
  // Validation
  errors: string[];
  isValid: boolean;
}

interface BulkTourImportProps {
  agencyId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const VALID_TYPES = ["DAYTRIP", "N2", "N3"];
const VALID_CURRENCIES = ["TRY", "USD", "EUR", "GBP", "SAR", "AED", "RUB"];

export function BulkTourImport({ agencyId, open, onClose, onSuccess }: BulkTourImportProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [parsedTours, setParsedTours] = useState<ParsedTour[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ETAP 1.5b: AI çeviri akışı
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);  // enabled_languages - "tr"
  const [translateProgress, setTranslateProgress] = useState<{ done: number; total: number } | null>(null);

  // enabled_languages'ı dialog açılırken acente kaydından çek.
  // Prop drilling yerine içeride fetch — BulkTourImport zaten agencyId'yi alıyor,
  // self-contained kalıyor; Admin.tsx'i değiştirmeye gerek yok.
  useEffect(() => {
    if (!open || !agencyId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("enabled_languages")
        .eq("id", agencyId)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setTargetLanguages([]);
        return;
      }
      const enabled = (Array.isArray(data.enabled_languages) ? data.enabled_languages : []) as string[];
      // Source dil ("tr") hedeften çıkar. Boşsa target=[] → checkbox disabled.
      setTargetLanguages(enabled.filter((l) => l && l !== SOURCE_LANG));
    })();
    return () => { cancelled = true; };
  }, [open, agencyId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Helper: opsiyonel string okuma (boş ise undefined)
        const _str = (v: any): string | undefined => {
          const s = v == null ? "" : String(v).trim();
          return s ? s : undefined;
        };
        // Helper: opsiyonel sayı okuma (NaN/0 → undefined)
        const _num = (v: any): number | undefined => {
          if (v == null || v === "") return undefined;
          const n = Number(v);
          return Number.isFinite(n) && n >= 0 ? n : undefined;
        };
        // Helper: opsiyonel boolean okuma (evet/hayır/yes/no/true/false/1/0)
        const _bool = (v: any): boolean | undefined => {
          if (v == null || v === "") return undefined;
          const s = String(v).trim().toLowerCase();
          if (["evet", "yes", "true", "1", "var", "gerekli", "ja", "oui", "sí", "si", "да", "نعم"].includes(s)) return true;
          if (["hayır", "hayir", "no", "false", "0", "yok", "gerekmez", "nein", "non", "нет", "لا"].includes(s)) return false;
          return undefined;
        };

        // ETAP 1.5a: Her satırı SÖZLÜK ile normalize et — yerel başlıklar (Programa breve,
        // Kurzprogramm, Программа, …) teknik isimlere çözülür. Tanınmayan başlıklar
        // toplanır ve parser sonunda kullanıcıya gösterilir.
        const unknownHeaders = new Set<string>();
        const rows = rawRows.map((rawRow) => normalizeRow(rawRow, unknownHeaders));

        const parsed: ParsedTour[] = rows.map((row, idx) => {
          const errors: string[] = [];

          // Zorunlu alanlar — sözlük zaten teknik isme çözdüğü için tek lookup yeterli.
          const title = String(row.title ?? "").trim();
          const destination = String(row.destination ?? "").trim();
          const rawType = String(row.type ?? "DAYTRIP").trim().toUpperCase();
          const rawCurrency = String(row.currency ?? "TRY").trim().toUpperCase();

          if (!title) errors.push(t("bulkImport.errors.titleRequired"));
          if (!destination) errors.push(t("bulkImport.errors.destinationRequired"));
          if (!VALID_TYPES.includes(rawType)) errors.push(`type: "${rawType}" ${t("bulk.invalidType")} (DAYTRIP/N2/N3)`);
          if (!VALID_CURRENCIES.includes(rawCurrency)) errors.push(`currency: "${rawCurrency}" ${t("bulk.invalidCurrency")}`);

          // Opsiyonel sayısal kontrol — geçersizse uyarı ama tur valid kalır
          const hotelStars = _num(row.hotel_stars);
          if (hotelStars !== undefined && (hotelStars < 1 || hotelStars > 5)) {
            errors.push(t("bulkImport.errors.hotelStarsRange", { defaultValue: "Otel yıldızı 1-5 arasında olmalı" }));
          }

          return {
            rowIndex: idx + 2,
            // Sistem alanı: __tour_id Excel'den okunur ama Etap 1'de YOKSAYILIR (insert akışı).
            // Etap 2'de UPSERT eşleşmesi için saklanır. Acente silmemeli; silinirse satır
            // yeni tur olarak insert edilir.
            __tour_id: _str(row.__tour_id),
            title,
            destination,
            type: VALID_TYPES.includes(rawType) ? (rawType as "DAYTRIP" | "N2" | "N3") : "DAYTRIP",
            currency: VALID_CURRENCIES.includes(rawCurrency) ? rawCurrency : "TRY",
            program_url: _str(row.program_url),
            program_kisa: _str(row.program_kisa),
            ulasim: _str(row.ulasim),
            gezilecek_yerler: _str(row.gezilecek_yerler),
            hareket_noktasi: _str(row.hareket_noktasi),
            toplanma_saati: _str(row.toplanma_saati),
            konaklama: _str(row.konaklama),
            hotel_name: _str(row.hotel_name),
            hotel_stars: hotelStars && hotelStars >= 1 && hotelStars <= 5 ? hotelStars : undefined,
            tur_kategorisi: _str(row.tur_kategorisi),
            tur_sure: _str(row.tur_sure),
            min_pax: _num(row.min_pax),
            visa_required: _bool(row.visa_required),
            visa_notes: _str(row.visa_notes),
            title_en: _str(row.title_en),
            title_de: _str(row.title_de),
            title_fr: _str(row.title_fr),
            title_es: _str(row.title_es),
            title_ru: _str(row.title_ru),
            title_ar: _str(row.title_ar),
            destination_en: _str(row.destination_en),
            destination_de: _str(row.destination_de),
            destination_fr: _str(row.destination_fr),
            destination_es: _str(row.destination_es),
            destination_ru: _str(row.destination_ru),
            destination_ar: _str(row.destination_ar),
            program_kisa_en: _str(row.program_kisa_en),
            program_kisa_de: _str(row.program_kisa_de),
            program_kisa_fr: _str(row.program_kisa_fr),
            program_kisa_es: _str(row.program_kisa_es),
            program_kisa_ru: _str(row.program_kisa_ru),
            program_kisa_ar: _str(row.program_kisa_ar),
            errors,
            isValid: errors.length === 0,
          };
        });

        setParsedTours(parsed);
        const validCount = parsed.filter((p) => p.isValid).length;
        toast({
          title: t("common.success"),
          description: t("bulkImport.parsed", { valid: validCount, total: parsed.length }),
        });
        // ETAP 1.5a: Tanınmayan başlıkları ayrı bir uyarı toast'ında göster — acente
        // yazım hatasını fark etsin. (Sözlükte yoksa sessizce yoksayma yerine görünür uyarı.)
        if (unknownHeaders.size > 0) {
          const list = [...unknownHeaders].join(", ");
          toast({
            title: t("bulkImport.warnUnknownColumns.title", { defaultValue: "Tanınmayan kolonlar" }),
            description: t("bulkImport.warnUnknownColumns.body", {
              defaultValue: "Şu kolonlar tanınmadı ve yoksayıldı: {{list}}",
              list,
            }),
            variant: "default",
            duration: 8000,
          });
        }
      } catch (err: any) {
        console.error(err);
        toast({ title: t("common.error"), description: t("bulkImport.errors.parseError"), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleImport = async () => {
    const valid = parsedTours.filter((p) => p.isValid);
    if (valid.length === 0) {
      toast({ title: t("common.error"), description: t("bulkImport.errors.noValid"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // ETAP 1: Tüm master alanları DB'ye INSERT edilir (pure insert, UPSERT yok).
      // __tour_id BİLİNÇLİ olarak GÖNDERİLMEZ — bu etapta yeni tur eklenir, DB yeni id üretir.
      // Etap 2 UPSERT eklendiğinde __tour_id varsa update / yoksa insert ayrımı yapılacak.
      // Undefined olanlar `null` olarak gönderilir (Supabase Insert tipi opsiyoneli kabul eder).
      const rows = valid.map((p) => ({
        agency_id: agencyId,
        title: p.title,
        destination: p.destination,
        type: p.type,
        currency: p.currency,
        program_url: p.program_url ?? null,
        program_kisa: p.program_kisa ?? null,
        ulasim: p.ulasim ?? null,
        gezilecek_yerler: p.gezilecek_yerler ?? null,
        hareket_noktasi: p.hareket_noktasi ?? null,
        toplanma_saati: p.toplanma_saati ?? null,
        konaklama: p.konaklama ?? null,
        hotel_name: p.hotel_name ?? null,
        hotel_stars: p.hotel_stars ?? null,
        tur_kategorisi: p.tur_kategorisi ?? null,
        tur_sure: p.tur_sure ?? null,
        min_pax: p.min_pax ?? 1,
        visa_required: p.visa_required ?? false,
        visa_notes: p.visa_notes ?? null,
        title_en: p.title_en ?? null,
        title_de: p.title_de ?? null,
        title_fr: p.title_fr ?? null,
        title_es: p.title_es ?? null,
        title_ru: p.title_ru ?? null,
        title_ar: p.title_ar ?? null,
        destination_en: p.destination_en ?? null,
        destination_de: p.destination_de ?? null,
        destination_fr: p.destination_fr ?? null,
        destination_es: p.destination_es ?? null,
        destination_ru: p.destination_ru ?? null,
        destination_ar: p.destination_ar ?? null,
        program_kisa_en: p.program_kisa_en ?? null,
        program_kisa_de: p.program_kisa_de ?? null,
        program_kisa_fr: p.program_kisa_fr ?? null,
        program_kisa_es: p.program_kisa_es ?? null,
        program_kisa_ru: p.program_kisa_ru ?? null,
        program_kisa_ar: p.program_kisa_ar ?? null,
      }));

      // INSERT'ten dönen kayıtların id+title+destination+program_kisa'sını al — çeviri için lazım.
      const { data: insertedRows, error } = await supabase
        .from("tours")
        .insert(rows)
        .select("id, title, destination, program_kisa");
      if (error) throw error;

      supabase.functions.invoke("invalidate-tour-cache", { body: { agencyId } }).catch(() => {});

      // ETAP 1.5b: AI ÇEVİRİ AKIŞI (best-effort, opsiyonel)
      // Kural: tur INSERT başarılı ve commit edildi (yukarıda). Çeviri buradan SONRA gelir;
      // çeviri fail olursa turlar zaten DB'de — kayıp olmaz.
      // Koşullar: checkbox açık + target dil var + tur sayısı ≤ tavan + insertedRows dolu.
      const _shouldTranslate =
        autoTranslate &&
        targetLanguages.length > 0 &&
        valid.length <= TRANSLATE_MAX_ROWS &&
        Array.isArray(insertedRows) && insertedRows.length > 0;

      let _translatedCount = 0;
      let _failedCount = 0;

      if (_shouldTranslate) {
        // Sadece source alanı (TR title/destination/program_kisa) dolu olan turları çevir.
        const _candidates = (insertedRows as any[]).filter(
          (r) => (r.title || r.destination || r.program_kisa),
        );

        if (_candidates.length > 0) {
          setTranslateProgress({ done: 0, total: _candidates.length });

          await runWithConcurrency(
            _candidates,
            TRANSLATE_CONCURRENCY,
            async (row) => {
              // batchMode=true → tek call'da tüm targetLanguages için JSON.
              // 1 retry: AI ya da network fail → bir kez tekrar dene.
              let lastErr: any = null;
              for (let attempt = 0; attempt <= TRANSLATE_RETRY; attempt++) {
                try {
                  const { data, error: invErr } = await supabase.functions.invoke("translate-tour", {
                    body: {
                      title: row.title || "",
                      destination: row.destination || "",
                      program_kisa: row.program_kisa || "",
                      sourceLanguage: SOURCE_LANG,
                      targetLanguages,
                      batchMode: true,
                    },
                  });
                  if (invErr) throw invErr;
                  const translations = (data?.translations || []) as Array<{
                    language: string;
                    title?: string;
                    destination?: string;
                    program_kisa?: string;
                  }>;
                  if (translations.length === 0) {
                    // AI fail veya boş çıktı — best-effort: bu tur çevirisiz kalır.
                    _failedCount++;
                    return;
                  }
                  // Çeviri sonucu → ilgili tur'un title_xx / destination_xx / program_kisa_xx UPDATE.
                  const _updatePayload: Record<string, any> = {};
                  for (const tr of translations) {
                    if (!tr.language) continue;
                    if (tr.title) _updatePayload[`title_${tr.language}`] = tr.title;
                    if (tr.destination) _updatePayload[`destination_${tr.language}`] = tr.destination;
                    if (tr.program_kisa) _updatePayload[`program_kisa_${tr.language}`] = tr.program_kisa;
                  }
                  if (Object.keys(_updatePayload).length === 0) {
                    _failedCount++;
                    return;
                  }
                  const { error: updErr } = await supabase
                    .from("tours")
                    .update(_updatePayload)
                    .eq("id", row.id)
                    .eq("agency_id", agencyId);   // defansif: cross-agency yazma engeli
                  if (updErr) throw updErr;
                  _translatedCount++;
                  return;
                } catch (err) {
                  lastErr = err;
                  // retry'a giderse continue; son denemede aşağı düş
                }
              }
              // Tüm retry'lar tükendi → best-effort fail
              console.warn("[bulk-import] translate failed for tour", row.id, lastErr);
              _failedCount++;
            },
            (done, total) => setTranslateProgress({ done, total }),
          );

          // Çeviriler bitti → cache invalidate (yeni title_xx vb. bot tarafına gelsin).
          supabase.functions.invoke("invalidate-tour-cache", { body: { agencyId } }).catch(() => {});
        }
      }

      // ─── Sonuç toast'ları (best-effort davranış) ─────────────────────────────
      if (_shouldTranslate) {
        if (_failedCount === 0 && _translatedCount > 0) {
          toast({
            title: t("common.success"),
            description: t("bulkImport.translate.toastSuccess", {
              defaultValue: "{{tours}} tur eklendi, çevirileri AI ile dolduruldu.",
              tours: rows.length,
            }),
          });
        } else if (_translatedCount > 0 && _failedCount > 0) {
          toast({
            title: t("common.success"),
            description: t("bulkImport.translate.toastPartial", {
              defaultValue: "{{tours}} tur eklendi, {{missing}} çeviri eksik kaldı — panelden tek tek tamamlayabilirsiniz.",
              tours: rows.length,
              missing: _failedCount,
            }),
            duration: 8000,
          });
        } else {
          toast({
            title: t("common.success"),
            description: t("bulkImport.translate.toastFail", {
              defaultValue: "{{tours}} tur eklendi, çeviri başarısız oldu. Sonra panelden tek tek çevirebilirsiniz.",
              tours: rows.length,
            }),
            duration: 8000,
          });
        }
      } else {
        toast({ title: t("common.success"), description: t("bulkImport.success", { count: rows.length }) });
      }
      setTranslateProgress(null);
      onSuccess();
      onClose();
      setParsedTours([]);
    } catch (err: any) {
      // Madde 1: Ham hata kullanıcıya gösterilmesin
      console.error("Import failed:", err?.message || err);
      toast({
        title: t("common.error"),
        description: t("bulkImport.errors.importFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ETAP 1.5c: Şablon indirme artık STANDALONE EXPORTED function `downloadTourImportTemplate`
  // ile sağlanıyor — dialog dışından (Admin.tsx toolbar) da çağrılabilsin diye.
  // Dialog içindeki tetik aynı fonksiyona pointer.
  const downloadTemplate = downloadTourImportTemplate;

  const validCount = parsedTours.filter((p) => p.isValid).length;
  const invalidCount = parsedTours.filter((p) => !p.isValid).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${isMobile ? "w-full max-w-none h-[95dvh]" : "max-w-4xl max-h-[90vh]"} overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t("bulkImport.title")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t("bulkImport.subtitle")}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Madde 2d: 3-adım rehber — acentenin akışı net görmesi için */}
          <Alert className="border-primary/30 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="space-y-2 text-sm">
              <p className="font-semibold">
                {t("bulkImport.guide.title", { defaultValue: "3 adımda toplu tur yükleme:" })}
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>{t("bulkImport.guide.step1", { defaultValue: "Aşağıdan şablonu indirin (Excel, .xlsx)" })}</li>
                <li>{t("bulkImport.guide.step2", { defaultValue: "Turlarınızı doldurun — 4 zorunlu alan: başlık, destinasyon, tip, para birimi. Diğer alanlar opsiyonel." })}</li>
                <li>{t("bulkImport.guide.step3", { defaultValue: "Dosyayı yükleyin — önizlemede kontrol edip onaylayın." })}</li>
              </ol>
              <p className="text-xs text-muted-foreground/80 pt-1 border-t border-border/40 mt-2">
                💡 {t("bulkImport.guide.tip", { defaultValue: "Bu Excel SADECE tur bilgisi içindir. Tur TARİHLERİ, FİYAT ve KONTENJAN panelden \"Toplu Tarih Oluştur\" ile eklenir." })}
              </p>
              <p className="text-xs text-muted-foreground/80">
                🔒 {t("bulkImport.guide.readonly", { defaultValue: "__tour_id ve created_at sistem alanlarıdır — değiştirmeyin/silmeyin." })}
              </p>
              <p className="text-xs text-muted-foreground/80">
                ✏️ {t("bulkImport.guide.alternative", { defaultValue: "Tek tur eklemek için \"Yeni Tur\" butonu daha hızlı olabilir." })}
              </p>
            </AlertDescription>
          </Alert>

          {/* Template download */}
          <Card className="p-4 bg-muted/30 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium text-sm">{t("bulkImport.needTemplate")}</p>
              <p className="text-xs text-muted-foreground">{t("bulkImport.templateDescription")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t("bulkImport.downloadTemplate")}
            </Button>
          </Card>

          {/* Upload area */}
          <Card className="p-6 border-dashed text-center space-y-3">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <Label htmlFor="excel-upload" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("bulkImport.selectFile")}
                  </span>
                </Button>
              </Label>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("bulkImport.fileHint")}</p>
          </Card>

          {/* ETAP 1.5b: AI ile otomatik çeviri tik kutusu — sadece preview varken anlamlı. */}
          {parsedTours.length > 0 && (() => {
            const _validCount = parsedTours.filter((p) => p.isValid).length;
            const _tooMany = _validCount > TRANSLATE_MAX_ROWS;
            const _noTargets = targetLanguages.length === 0;
            const _disabled = _tooMany || _noTargets;
            return (
              <Card className="p-3 bg-primary/5 border-primary/30">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="auto-translate"
                    checked={autoTranslate && !_disabled}
                    disabled={_disabled || isLoading}
                    onCheckedChange={(v) => setAutoTranslate(v === true)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor="auto-translate"
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-medium cursor-pointer",
                        _disabled && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <Languages className="h-4 w-4 text-primary" />
                      {t("bulkImport.translate.checkboxLabel", { defaultValue: "🌐 Çevirileri AI ile otomatik yap" })}
                    </Label>
                    {_noTargets ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {t("bulkImport.translate.noTargetLangs", {
                          defaultValue: "Çevrilecek dil yok — önce Dil Yönetimi'nden dil ekleyin.",
                        })}
                      </p>
                    ) : _tooMany ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {t("bulkImport.translate.tooManyToursHint", {
                          defaultValue: "{{count}}+ tur için çeviriyi panelden tek tek yapın.",
                          count: TRANSLATE_MAX_ROWS,
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("bulkImport.translate.checkboxHint", {
                          defaultValue: "Paketinizde aktif dillere ({{count}} dil) çeviri yapılır.",
                          count: targetLanguages.length,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* ETAP 1.5b: Çeviri ilerleme barı — import sırasında AI çağrıları sürerken. */}
          {translateProgress && (
            <Card className="p-3 bg-primary/5 border-primary/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  {t("bulkImport.translate.progress", {
                    defaultValue: "Çevriliyor: {{done}}/{{total}}",
                    done: translateProgress.done,
                    total: translateProgress.total,
                  })}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.round((translateProgress.done / Math.max(translateProgress.total, 1)) * 100)}%
                </span>
              </div>
              <Progress
                value={(translateProgress.done / Math.max(translateProgress.total, 1)) * 100}
                className="h-1.5"
              />
            </Card>
          )}

          {/* Parsed preview */}
          {parsedTours.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="font-semibold text-sm">{t("bulkImport.parsedTours")}</p>
                <div className="flex gap-2">
                  <Badge className="bg-green-500 text-white gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {validCount} {t("bulkImport.valid")}
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {invalidCount} {t("bulkImport.invalid")}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{t("admin.tours.title")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("admin.tours.destination")}</TableHead>
                      <TableHead className="hidden sm:table-cell">Tip</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTours.map((tour) => (
                      <TableRow key={tour.rowIndex} className={!tour.isValid ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{tour.rowIndex}</TableCell>
                        <TableCell className="font-medium max-w-[160px] truncate">{tour.title || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{tour.destination || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{tour.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {tour.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <div>
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              <p className="text-xs text-destructive mt-0.5">{tour.errors[0]}</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleImport} disabled={isLoading || validCount === 0}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("bulkImport.importing")}</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />{t("bulkImport.importButton", { count: validCount })}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
