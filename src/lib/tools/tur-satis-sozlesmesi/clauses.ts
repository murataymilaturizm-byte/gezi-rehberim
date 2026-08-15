// ARAÇ-4 / iki belgenin madde üreticisi — TEK KAYNAK.
//
// HUKUKİ DİSİPLİN (M8 + ARAÇ-1 rejimi, burada iki kat sıkı):
//  · Metinler "örnek iskelet" dilinde. UYDURMA yönetmelik madde-numarası veya
//    oran YOK. Mevzuata atıf gereken yerde genel ifade kullanılır.
//  · Boş bırakılan opsiyonel alanın cümlesi/maddesi TAMAMEN düşer, numaralar kayar.
//  · İptal merdiveni TEK state'ten beslenir: sözleşmeye madde, ön bilgilendirmeye
//    özet tablo olarak render edilir → iki belgede farklı görünmesi imkânsız.

import type { DocSection, SignatureBlock, DocSpec } from "../docx";
import { trDate } from "../docx";
import {
  type SalesContractData,
  participantCount,
} from "./schema";

export const CONTRACT_TITLE = "PAKET TUR SATIŞ SÖZLEŞMESİ";
export const PREBRIEF_TITLE = "ÖN BİLGİLENDİRME FORMU";

export const LAWYER_NOTE_TOP =
  "Bu belge örnek bir iskelettir; kullanmadan önce güncel mevzuata göre avukatınıza inceletin.";
export const LAWYER_NOTE_BOTTOM =
  "Bu metin bilgilendirme amaçlı bir örnek iskelettir, hukuki danışmanlık değildir. İlgili mevzuat hükümleri saklıdır.";
export const BRAND_LINE =
  "Bu belge turzzai.com/araclar üzerindeki ücretsiz araçla oluşturulmuştur.";

export const DELIVERY_STATEMENT =
  "İşbu ön bilgilendirme formu, satış işleminin gerçekleşmesinden önce tüketiciye verilmiş / kalıcı veri saklayıcısı ile iletilmiştir.";

/** Para tutarı metni — boşsa boş döner */
function tutar(v: string, birim: string): string {
  const s = (v || "").trim();
  return s ? `${s} ${birim}`.trim() : "";
}

/** Kişi başı + toplam bedeli birlikte yazar (tartışmayı baştan kapatır) */
export function bedelCumlesi(d: SalesContractData): string {
  const n = participantCount(d);
  const raw = parseFloat((d.bedelTutar || "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(raw) || raw <= 0) return "";
  const fmt = (x: number) =>
    x.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " " + d.paraBirimi;
  if (n > 0) {
    const kisiBasi = d.bedelBazi === "kisi" ? raw : raw / n;
    const toplam = d.bedelBazi === "kisi" ? raw * n : raw;
    return `Tur bedeli kişi başı ${fmt(kisiBasi)} olup, ${n} katılımcı için toplam ${fmt(toplam)}'dir.`;
  }
  return `Tur bedeli ${fmt(raw)}'dir.`;
}

/** Dolu merdiven satırları — iki belge de BUNU kullanır */
export function ladderRows(d: SalesContractData): string[][] {
  return d.merdiven
    .filter((r) => r.sure.trim() && r.iade.trim())
    .map((r) => [r.sure.trim(), r.iade.trim()]);
}

/** Katılımcı özeti */
function katilimciCumlesi(d: SalesContractData): string {
  const y = parseInt(d.yetiskinSayisi, 10) || 0;
  const c = parseInt(d.cocukSayisi, 10) || 0;
  if (!y && !c) return "";
  const parcalar = [y ? `${y} yetişkin` : "", c ? `${c} çocuk` : ""].filter(Boolean);
  return `Tura ${parcalar.join(" ve ")} olmak üzere toplam ${y + c} kişi katılacaktır.`;
}

function tarihAraligi(d: SalesContractData): string {
  const b = trDate(d.baslangicTarihi);
  const s = trDate(d.bitisTarihi);
  if (b && s) return `${b} — ${s}`;
  return b || s || "";
}

// ═══════════════════════════════════════════════════════════════════════
// BELGE 1 — PAKET TUR SATIŞ SÖZLEŞMESİ
// ═══════════════════════════════════════════════════════════════════════
export function buildContractSections(d: SalesContractData): DocSection[] {
  const out: Omit<DocSection, "no">[] = [];

  // 1 — Taraflar
  const acenteSatir = [
    d.acenteUnvan && `Unvan: ${d.acenteUnvan}`,
    d.acenteTursab && `TÜRSAB belge no: ${d.acenteTursab}`,
    d.acenteAdres && `Adres: ${d.acenteAdres}`,
    d.acenteTelefon && `Telefon: ${d.acenteTelefon}`,
    d.acenteEposta && `E-posta: ${d.acenteEposta}`,
    d.acenteVergi && `Vergi no: ${d.acenteVergi}`,
  ].filter(Boolean) as string[];
  const musteriSatir = [
    d.musteriAd && `Ad-soyad: ${d.musteriAd}`,
    d.musteriAdres && `Adres: ${d.musteriAdres}`,
    d.musteriTelefon && `Telefon: ${d.musteriTelefon}`,
    d.musteriEposta && `E-posta: ${d.musteriEposta}`,
  ].filter(Boolean) as string[];
  out.push({
    baslik: "Taraflar",
    paragraflar: [
      "İşbu sözleşme, aşağıda bilgileri yer alan seyahat acentesi (bundan sonra ACENTE) ile tur katılımcısı/tüketici (bundan sonra MÜŞTERİ) arasında düzenlenmiştir.",
      ...(acenteSatir.length ? [`ACENTE — ${acenteSatir.join(" · ")}`] : []),
      ...(musteriSatir.length ? [`MÜŞTERİ — ${musteriSatir.join(" · ")}`] : []),
    ],
  });

  // 2 — Konu
  const konu = [
    `İşbu sözleşmenin konusu, ACENTE tarafından düzenlenen "${d.turAdi || "…"}" adlı paket turun MÜŞTERİ'ye satışı ve tarafların hak ve yükümlülüklerinin belirlenmesidir.`,
    d.guzergah && `Güzergâh: ${d.guzergah}`,
    tarihAraligi(d) && `Tur tarihleri: ${tarihAraligi(d)}`,
    katilimciCumlesi(d),
    d.katilimciAdlari.trim() && `Katılımcılar: ${d.katilimciAdlari.trim().replace(/\s*\n\s*/g, ", ")}`,
  ].filter(Boolean) as string[];
  out.push({ baslik: "Sözleşmenin Konusu", paragraflar: konu });

  // 3 — Dahil hizmetler
  if (d.dahilHizmetler.length) {
    out.push({
      baslik: "Tur Bedeline Dahil Hizmetler",
      paragraflar: [
        "Tur bedeline aşağıdaki hizmetler dahildir:",
        ...d.dahilHizmetler.map((s) => `— ${s.label}`),
      ],
    });
  }

  // 4 — HARİÇ hizmetler (vurgulu, ayrı madde)
  if (d.haricHizmetler.length) {
    out.push({
      baslik: "Tur Bedeline Dahil OLMAYAN Hizmetler",
      paragraflar: [
        "Aşağıdaki hizmetler tur bedeline DAHİL DEĞİLDİR; bu kalemlerden doğan bedeller MÜŞTERİ tarafından ayrıca karşılanır:",
        ...d.haricHizmetler.map((s) => `— ${s.label}`),
        "Bu listede yer almayan ve programda açıkça belirtilmeyen hizmetler için tarafların yazılı mutabakatı esastır.",
      ],
    });
  }

  // 5 — Konaklama ve ulaşım
  const konaklama = [
    d.tesisAdi && `Konaklama tesisi: ${d.tesisAdi}`,
    d.odaTipi && `Oda tipi: ${d.odaTipi}`,
    d.geceSayisi && `Konaklama süresi: ${d.geceSayisi} gece`,
    d.ulasimTuru && `Ulaşım: ${d.ulasimTuru}`,
  ].filter(Boolean) as string[];
  if (konaklama.length) {
    out.push({
      baslik: "Konaklama ve Ulaşım",
      paragraflar: [
        ...konaklama,
        "Tesis veya ulaşım aracında zorunlu hâllerde yapılacak değişikliklerde, aynı veya üst nitelikte alternatif sunulması esastır ve değişiklik MÜŞTERİ'ye gecikmeksizin bildirilir.",
      ],
    });
  }

  // 6 — Bedel ve ödeme
  const odeme = [
    bedelCumlesi(d),
    tutar(d.kaporaTutar, d.paraBirimi) &&
      `Satış anında ${tutar(d.kaporaTutar, d.paraBirimi)} tutarında kapora tahsil edilir.`,
    d.kalanVade && `Bakiye ödeme vadesi: ${d.kalanVade}.`,
    d.odemeYollari && `Ödeme yolları: ${d.odemeYollari}.`,
  ].filter(Boolean) as string[];
  if (odeme.length) out.push({ baslik: "Tur Bedeli ve Ödeme Planı", paragraflar: odeme });

  // 7 — Müşteri iptali + merdiven
  const rows = ladderRows(d);
  const iptalParas = [
    "MÜŞTERİ, tura katılmaktan vazgeçtiğini ACENTE'ye yazılı olarak bildirebilir. Bildirimin ACENTE'ye ulaştığı tarih esas alınır.",
    rows.length
      ? "İptal bildiriminin turun başlangıcına kalan süresine göre uygulanacak iade yaklaşımı aşağıdaki tabloda gösterilmiştir:"
      : "İptal hâlinde uygulanacak iade koşulları taraflarca ayrıca belirlenir ve yazılı olarak MÜŞTERİ'ye bildirilir.",
  ];
  if (d.devirAlternatifi) {
    iptalParas.push(
      "MÜŞTERİ, iptal yerine turu uygun koşullarda başka bir tarihe aktarabilir veya sözleşmeden doğan haklarını kendisi yerine tura katılacak bir kişiye devredebilir. Bu talep, ACENTE'ye makul bir süre öncesinde yazılı olarak iletilir; tedarikçi kaynaklı zorunlu farklar MÜŞTERİ'ye yansıtılabilir.",
    );
  }
  iptalParas.push("İade ödemesi, MÜŞTERİ'nin bildirdiği kanaldan ve makul süre içinde gerçekleştirilir. İlgili mevzuat hükümleri saklıdır.");
  out.push({
    baslik: "Müşteri Kaynaklı İptal, Devir ve İade",
    paragraflar: iptalParas,
    ...(rows.length ? { tablo: { basliklar: ["Turun başlangıcına kalan süre", "Uygulanacak iade yaklaşımı"], satirlar: rows } } : {}),
  });

  // 8 — Acente iptali
  out.push({
    baslik: "Acente Kaynaklı İptal ve Değişiklikler",
    paragraflar: [
      "ACENTE, zorunlu hâller dışında turu iptal etmemeyi taahhüt eder. ACENTE'den kaynaklanan iptal hâlinde MÜŞTERİ'ye tahsil edilen bedelin tamamının iadesi veya MÜŞTERİ'nin kabul etmesi hâlinde eşdeğer nitelikte alternatif bir tur sunulur.",
      "Turun içeriğinde esaslı bir değişiklik yapılması gerektiğinde durum MÜŞTERİ'ye gecikmeksizin bildirilir; MÜŞTERİ değişikliği kabul etmediği takdirde sözleşmeden dönebilir ve ödediği bedelin iadesini talep edebilir. İlgili mevzuat hükümleri saklıdır.",
    ],
  });

  // 9 — Mücbir sebep
  out.push({
    baslik: "Mücbir Sebep",
    paragraflar: [
      "Olumsuz hava koşulları, yol kapanması, doğal afet, salgın, resmî makam kararları ve tarafların kontrolü dışındaki benzer hâllerde hizmetin verilememesi mücbir sebep sayılır.",
      "Mücbir sebep hâlinde taraflardan hiçbiri diğerine karşı kusurlu sayılmaz; bu durumda tarih değişikliği, eşdeğer alternatif veya tahsil edilen bedelin iadesi seçeneklerinden biri taraflarca birlikte belirlenir.",
    ],
  });

  // 10 — Yükümlülükler
  out.push({
    baslik: "Tarafların Yükümlülükleri",
    paragraflar: [
      "MÜŞTERİ, tur için gerekli kimlik ve seyahat belgelerinin geçerliliğinden ve buluşma noktasında bildirilen saatte hazır bulunmaktan sorumludur. Zamanında hazır bulunulmaması nedeniyle hizmetten yararlanılamaması hâlinde iade talep edilemez.",
      "ACENTE, satış öncesinde turun kapsamı, bedeli, ödeme planı ve iptal-iade koşulları hakkında MÜŞTERİ'yi yazılı olarak bilgilendirmekle yükümlüdür. İşbu sözleşmenin eki niteliğindeki Ön Bilgilendirme Formu, satıştan önce MÜŞTERİ'ye verilmiştir.",
    ],
  });

  // 11 — Şikâyet
  const kanal = d.sikayetKanali.trim() || d.acenteTelefon.trim();
  out.push({
    baslik: "Şikâyet ve Bildirim",
    paragraflar: [
      kanal
        ? `Hizmete ilişkin şikâyet ve talepler ${kanal} üzerinden ACENTE'ye iletilir; ACENTE bildirimi makul süre içinde değerlendirerek MÜŞTERİ'ye dönüş yapar.`
        : "Hizmete ilişkin şikâyet ve talepler ACENTE'ye yazılı olarak iletilir; ACENTE bildirimi makul süre içinde değerlendirerek MÜŞTERİ'ye dönüş yapar.",
      "Tur sırasında ortaya çıkan aksaklıkların, giderilebilmesi için mümkün olan en kısa sürede ACENTE veya tur sorumlusuna bildirilmesi esastır.",
    ],
  });

  // 12 — Ek koşullar (opsiyonel)
  if (d.ekKosullar.trim()) {
    out.push({
      baslik: "Ek Koşullar",
      paragraflar: d.ekKosullar.trim().split(/\n+/).filter(Boolean),
    });
  }

  // 13 — Yürürlük
  const yer = d.duzenlemeYeri.trim();
  const tarih = trDate(d.sozlesmeTarihi);
  out.push({
    baslik: "Yürürlük",
    paragraflar: [
      [
        "İşbu sözleşme",
        yer ? `${yer}'de` : "",
        tarih ? `${tarih} tarihinde` : "",
        "iki nüsha olarak düzenlenmiş, taraflarca okunarak imzalanmış ve yürürlüğe girmiştir.",
      ]
        .filter(Boolean)
        .join(" "),
      "Taraflar arasındaki uyuşmazlıklarda ilgili mevzuat hükümleri uygulanır.",
    ],
  });

  return out.map((s, i) => ({ ...s, no: i + 1 }));
}

// ═══════════════════════════════════════════════════════════════════════
// BELGE 2 — ÖN BİLGİLENDİRME FORMU
// Sözleşmenin kısaltılmışı DEĞİL: satıştan önce okunması için özet ve
// tablo ağırlıklı, numarasız bölümlerden oluşan farklı işlevli bir belge.
// ═══════════════════════════════════════════════════════════════════════
export function buildPrebriefSections(d: SalesContractData): DocSection[] {
  const out: DocSection[] = [];
  const push = (baslik: string, paragraflar: string[], tablo?: DocSection["tablo"]) => {
    if (!paragraflar.length && !tablo) return;
    out.push({ no: null, baslik, paragraflar, ...(tablo ? { tablo } : {}) });
  };

  push("Acente Bilgileri", [
    d.acenteUnvan && `Unvan: ${d.acenteUnvan}`,
    d.acenteTursab && `TÜRSAB belge no: ${d.acenteTursab}`,
    d.acenteAdres && `Adres: ${d.acenteAdres}`,
    d.acenteTelefon && `Telefon: ${d.acenteTelefon}`,
    d.acenteEposta && `E-posta: ${d.acenteEposta}`,
  ].filter(Boolean) as string[]);

  push("Tur Bilgileri", [
    d.turAdi && `Tur adı: ${d.turAdi}`,
    d.guzergah && `Güzergâh: ${d.guzergah}`,
    tarihAraligi(d) && `Tarihler: ${tarihAraligi(d)}`,
    katilimciCumlesi(d),
  ].filter(Boolean) as string[]);

  push("Konaklama ve Ulaşım", [
    d.tesisAdi && `Tesis: ${d.tesisAdi}`,
    d.odaTipi && `Oda tipi: ${d.odaTipi}`,
    d.geceSayisi && `${d.geceSayisi} gece konaklama`,
    d.ulasimTuru && `Ulaşım: ${d.ulasimTuru}`,
  ].filter(Boolean) as string[]);

  if (d.dahilHizmetler.length)
    push("Fiyata Dahil Olanlar", d.dahilHizmetler.map((s) => `— ${s.label}`));

  if (d.haricHizmetler.length)
    push("Fiyata Dahil OLMAYANLAR", [
      "Aşağıdaki kalemler tur bedeline dahil değildir:",
      ...d.haricHizmetler.map((s) => `— ${s.label}`),
    ]);

  push("Toplam Bedel ve Ödeme Planı", [
    bedelCumlesi(d),
    tutar(d.kaporaTutar, d.paraBirimi) && `Kapora: ${tutar(d.kaporaTutar, d.paraBirimi)}`,
    d.kalanVade && `Bakiye ödeme vadesi: ${d.kalanVade}`,
    d.odemeYollari && `Ödeme yolları: ${d.odemeYollari}`,
  ].filter(Boolean) as string[]);

  // Merdiven — sözleşmeyle AYNI kaynaktan
  const rows = ladderRows(d);
  const iptalParas = [
    rows.length
      ? "Tura katılmaktan vazgeçmeniz hâlinde, bildirimin turun başlangıcına kalan süresine göre uygulanacak iade yaklaşımı aşağıdadır:"
      : "İptal hâlinde uygulanacak iade koşulları satış öncesinde ayrıca yazılı olarak bildirilir.",
  ];
  if (d.devirAlternatifi)
    iptalParas.push("İptal yerine tarih değişikliği veya turu başka bir katılımcıya devretme seçeneği sunulmaktadır.");
  push(
    "İptal ve İade Koşulları",
    iptalParas,
    rows.length ? { basliklar: ["Turun başlangıcına kalan süre", "Uygulanacak iade yaklaşımı"], satirlar: rows } : undefined,
  );

  push("Acente Kaynaklı İptal ve Değişiklik", [
    "Zorunlu hâller dışında tur iptal edilmez. Acenteden kaynaklanan iptalde ödenen bedelin tamamı iade edilir veya kabul etmeniz hâlinde eşdeğer nitelikte alternatif tur sunulur.",
    "Tur içeriğinde esaslı bir değişiklik gerekirse durum gecikmeksizin bildirilir; değişikliği kabul etmemeniz hâlinde sözleşmeden dönme ve ödediğiniz bedeli geri alma hakkınız saklıdır.",
  ]);

  const kanal = d.sikayetKanali.trim() || d.acenteTelefon.trim();
  push("Şikâyet ve İletişim", [
    kanal
      ? `Şikâyet ve talepleriniz için: ${kanal}`
      : "Şikâyet ve talepleriniz acenteye yazılı olarak iletilebilir.",
    "Tur sırasında yaşanan aksaklıkları, giderilebilmesi için en kısa sürede tur sorumlusuna bildirmeniz önerilir.",
  ]);

  return out;
}

// ── DocSpec üreticileri (docx + önizleme aynı kaynağı kullanır) ──

export function contractSpec(d: SalesContractData): DocSpec {
  return {
    baslik: CONTRACT_TITLE,
    ustNot: LAWYER_NOTE_TOP,
    bolumler: buildContractSections(d),
    imzalar: [
      { rol: "ACENTE", isim: d.acenteUnvan || "…" },
      { rol: "MÜŞTERİ", isim: d.musteriAd || "…" },
    ],
    altNot: LAWYER_NOTE_BOTTOM,
    markaSatiri: BRAND_LINE,
  };
}

export function prebriefSpec(d: SalesContractData): DocSpec {
  const teslim = trDate(d.formTeslimTarihi);
  return {
    baslik: PREBRIEF_TITLE,
    ustNot: LAWYER_NOTE_TOP,
    bolumler: buildPrebriefSections(d),
    beyan: teslim ? `${DELIVERY_STATEMENT} Teslim tarihi: ${teslim}.` : DELIVERY_STATEMENT,
    imzalar: [
      { rol: "FORMU VEREN (ACENTE)", isim: d.acenteUnvan || "…", altNot: teslim ? `Tarih: ${teslim}` : undefined },
      { rol: "FORMU TESLİM ALAN (TÜKETİCİ)", isim: d.musteriAd || "…", altNot: teslim ? `Tarih: ${teslim}` : undefined },
    ],
    altNot: LAWYER_NOTE_BOTTOM,
    markaSatiri: BRAND_LINE,
  };
}

/** Form teslim tarihi sözleşmeden SONRA mı? (nazik uyarı için) */
export function deliveryDateWarning(d: SalesContractData): boolean {
  if (!d.formTeslimTarihi || !d.sozlesmeTarihi) return false;
  return d.formTeslimTarihi > d.sozlesmeTarihi;
}
