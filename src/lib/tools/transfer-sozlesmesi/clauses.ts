// ARAÇ-6 / madde üreticisi — TEK KAYNAK (önizleme ve Word aynı yapıdan).
//
// HUKUKİ DİSİPLİN (M8 rejimi): metinler "örnek iskelet" dilinde; UYDURMA
// yönetmelik madde-numarası veya oran YOK; mevzuata atıf gereken yerde genel
// ifade ("ilgili mevzuat hükümleri saklıdır").
//
// BELGENİN ÖZÜ: ikame araç maddesi. M4-#7'de anlattığımız "tedarikçi zincirini
// tek ağıza bağlamak" hatasının yazılı karşılığı budur — arıza günü ne olacağı
// sözleşmede yazmıyorsa, o gün pazarlık başlar.

import type { DocSection, DocSpec, SignatureBlock } from "../docx";
import { trDate } from "../docx";
import {
  type TransferData, COST_ITEMS, FEE_BASIS_LABEL,
  filledVehicles, filledDrivers,
} from "./schema";

export const DOC_TITLE = "TAŞIMA HİZMETİ SÖZLEŞMESİ";
export const LAWYER_NOTE_TOP =
  "Bu belge örnek bir iskelettir; kullanmadan önce güncel mevzuata göre avukatınıza inceletin.";
export const LAWYER_NOTE_BOTTOM =
  "Bu metin bilgilendirme amaçlı bir örnek iskelettir, hukuki danışmanlık değildir. İlgili mevzuat hükümleri saklıdır.";
export const BRAND_LINE =
  "Bu belge turzzai.com/araclar üzerindeki ücretsiz araçla oluşturulmuştur.";

function tutarCumlesi(d: TransferData): string {
  const t = (d.bedelTutar || "").trim();
  if (!t) return "";
  return `Hizmet bedeli ${t} ${d.paraBirimi} olup ${FEE_BASIS_LABEL[d.bedelBazi]} hesaplanır.`;
}

/** İşin tanımı — MODA göre değişir (iki mod aynı belgede karışmaz) */
export function isTanimiParagraflari(d: TransferData): string[] {
  const out: string[] = [];
  out.push(
    `İşbu sözleşmenin konusu, ACENTE'nin düzenlediği "${d.isAdi || "…"}" kapsamında TAŞIYICI tarafından sağlanacak karayolu taşıma hizmetidir.`,
  );
  if (d.guzergah.trim()) out.push(`Güzergâh: ${d.guzergah.trim()}`);

  if (d.mod === "tek-sefer") {
    const tarih = trDate(d.seferTarihi);
    const parcalar = [
      tarih && `Sefer tarihi: ${tarih}`,
      d.seferSaati.trim() && `Hareket saati: ${d.seferSaati.trim()}`,
      d.bulusmaNoktasi.trim() && `Buluşma noktası: ${d.bulusmaNoktasi.trim()}`,
    ].filter(Boolean) as string[];
    out.push(...parcalar);
    out.push("Hizmet, yukarıda belirtilen tek sefer için sağlanacaktır.");
  } else {
    const b = trDate(d.donemBaslangic);
    const s = trDate(d.donemBitis);
    if (b && s) out.push(`Hizmet dönemi: ${b} — ${s}`);
    else if (b) out.push(`Hizmet dönemi başlangıcı: ${b}`);
    if (d.donemGunler.trim()) out.push(`Sefer günleri: ${d.donemGunler.trim()}`);
    out.push(
      "Hizmet, belirtilen dönem boyunca ACENTE'nin bildireceği sefer programına göre sağlanacaktır. Her sefer, ACENTE tarafından makul bir süre öncesinde yazılı olarak bildirilir.",
    );
  }
  return out;
}

export function buildTransferSections(d: TransferData): DocSection[] {
  const out: Omit<DocSection, "no">[] = [];

  // 1 — Taraflar
  const acente = [
    d.acenteUnvan && `Unvan: ${d.acenteUnvan}`,
    d.acenteTursab && `TÜRSAB belge no: ${d.acenteTursab}`,
    d.acenteAdres && `Adres: ${d.acenteAdres}`,
    d.acenteTelefon && `Telefon: ${d.acenteTelefon}`,
    d.acenteYetkili && `Yetkili: ${d.acenteYetkili}`,
  ].filter(Boolean) as string[];
  const tasiyici = [
    d.tasiyiciUnvan && `Unvan / ad: ${d.tasiyiciUnvan}`,
    d.tasiyiciYetkiBelge && `Yetki belgesi no: ${d.tasiyiciYetkiBelge}`,
    d.tasiyiciAdres && `Adres: ${d.tasiyiciAdres}`,
    d.tasiyiciTelefon && `Telefon: ${d.tasiyiciTelefon}`,
  ].filter(Boolean) as string[];
  out.push({
    baslik: "Taraflar",
    paragraflar: [
      "İşbu sözleşme, aşağıda bilgileri yer alan seyahat acentesi (bundan sonra ACENTE) ile taşıma hizmetini sağlayan firma/kişi (bundan sonra TAŞIYICI) arasında düzenlenmiştir.",
      ...(acente.length ? [`ACENTE — ${acente.join(" · ")}`] : []),
      ...(tasiyici.length ? [`TAŞIYICI — ${tasiyici.join(" · ")}`] : []),
    ],
  });

  // 2 — İşin konusu (moda göre)
  out.push({ baslik: "Sözleşmenin Konusu", paragraflar: isTanimiParagraflari(d) });

  // 3 — Araçlar (tablo) — boşsa madde düşer
  const araclar = filledVehicles(d);
  if (araclar.length) {
    out.push({
      baslik: "Hizmete Tahsis Edilen Araçlar",
      paragraflar: [
        "Hizmet aşağıda belirtilen araç/araçlarla sağlanacaktır. Araç değişikliği, ACENTE'ye önceden bildirilir ve eşdeğer nitelikte araçla yapılır.",
      ],
      tablo: {
        basliklar: ["Araç tipi", "Plaka", "Koltuk"],
        satirlar: araclar.map((v) => [v.tip.trim() || "—", v.plaka.trim() || "—", v.koltuk.trim() || "—"]),
      },
    });
  }

  // 4 — Şoförler — boşsa madde düşer
  const soforler = filledDrivers(d);
  if (soforler.length) {
    out.push({
      baslik: "Görevli Şoförler",
      paragraflar: [
        ...soforler.map((s) => `— ${[s.ad.trim(), s.telefon.trim()].filter(Boolean).join(" · ")}`),
        "TAŞIYICI, görevlendirdiği şoförlerin gerekli ehliyet ve mesleki yeterlilik belgelerine sahip olduğunu beyan eder.",
      ],
    });
  }

  // 5 — Bedel, masraflar, ödeme
  const masrafSatirlari = COST_ITEMS
    .filter((c) => d.masraflar[c.key])
    .map((c) => [c.label, d.masraflar[c.key] === "acente" ? "ACENTE" : "TAŞIYICI"]);
  const bedelParas = [
    tutarCumlesi(d),
    masrafSatirlari.length
      ? "Aşağıdaki masraf kalemlerinin hangi tarafa ait olduğu tabloda gösterilmiştir:"
      : "",
    d.odemeVadesi.trim() && `Ödeme vadesi: ${d.odemeVadesi.trim()}.`,
    "Bedelde değişiklik, tarafların yazılı mutabakatı ile yapılır.",
  ].filter(Boolean) as string[];
  out.push({
    baslik: "Hizmet Bedeli, Masraflar ve Ödeme",
    paragraflar: bedelParas,
    ...(masrafSatirlari.length
      ? { tablo: { basliklar: ["Masraf kalemi", "Kime ait"], satirlar: masrafSatirlari } }
      : {}),
  });

  // 6 — İKAME ARAÇ (belgenin özü — HER ZAMAN basılır)
  const ikameParas = [
    "TAŞIYICI, tahsis edilen aracın arıza, kaza, bakım veya benzeri bir sebeple hizmeti sağlayamaz duruma gelmesi hâlinde, hizmetin kesintiye uğramaması için ikame araç temin etmekle yükümlüdür.",
  ];
  if (d.ikameSure.trim()) {
    ikameParas.push(
      `İkame araç, arızanın öğrenildiği andan itibaren en geç ${d.ikameSure.trim()} saat içinde hizmete hazır hâle getirilir.`,
    );
  } else {
    ikameParas.push(
      "İkame araç, hizmetin aksamasını önleyecek en kısa sürede hizmete hazır hâle getirilir.",
    );
  }
  if (d.ikameKapasite) {
    ikameParas.push(
      "İkame araç, sözleşmede belirtilen araçla eşdeğer veya üst nitelikte ve en az aynı koltuk kapasitesinde olur.",
    );
  }
  ikameParas.push(
    "İkame araç temin edilememesi nedeniyle turun kısmen veya tamamen gerçekleştirilememesi hâlinde, ACENTE'nin bu sebeple uğradığı zararlara ilişkin talep hakları saklıdır.",
    "TAŞIYICI, aracın hizmeti sağlayamaz duruma geldiğini öğrendiği anda ACENTE'yi gecikmeksizin bilgilendirir.",
  );
  out.push({ baslik: "Araç Arızası ve İkame Araç Yükümlülüğü", paragraflar: ikameParas });

  // 7 — Gecikme, iptal ve karşılıklı bildirim
  const bildirimParas = [
    "Taraflar, hizmetin başlangıç saatinde veya programında gecikme ya da iptal gerektiren bir durum ortaya çıktığında birbirini gecikmeksizin bilgilendirir.",
  ];
  if (d.bildirimSaat.trim()) {
    bildirimParas.push(
      `Öngörülebilir iptal ve değişiklikler, seferin başlangıcından en az ${d.bildirimSaat.trim()} saat önce yazılı olarak bildirilir.`,
    );
  }
  bildirimParas.push(
    "ACENTE kaynaklı iptallerde TAŞIYICI'nın o sefer için yaptığı zorunlu masraflar, belgelendirilmesi hâlinde karşılanır.",
    "TAŞIYICI kaynaklı iptallerde, ACENTE'nin ikame taşıma temini için yapmak zorunda kaldığı ek masraflara ilişkin talep hakları saklıdır.",
  );
  out.push({ baslik: "Gecikme, İptal ve Bildirim", paragraflar: bildirimParas });

  // 8 — Sigorta ve sorumluluk
  const sigortaParas = [
    "TAŞIYICI, hizmete tahsis ettiği araçların trafiğe uygun ve bakımlı olduğunu, sürücülerinin gerekli belgelere sahip bulunduğunu beyan eder.",
  ];
  if (d.sigortaBeyani) {
    sigortaParas.push(
      "TAŞIYICI, taşıma faaliyeti için mevzuatça aranan zorunlu sigortaların sözleşme süresince geçerli olduğunu beyan eder; ACENTE talep ettiğinde ilgili poliçe bilgilerini ibraz eder.",
    );
  }
  sigortaParas.push(
    "Taşıma sırasında yolculara veya bagajlara verilen zararlardan, TAŞIYICI'nın kendi kusuru ve sorumluluk sigortası kapsamı çerçevesinde TAŞIYICI sorumludur. İlgili mevzuat hükümleri saklıdır.",
  );
  out.push({ baslik: "Sigorta ve Sorumluluk", paragraflar: sigortaParas });

  // 9 — Mücbir sebep
  out.push({
    baslik: "Mücbir Sebep",
    paragraflar: [
      "Olumsuz hava koşulları, yol kapanması, doğal afet, resmî makam kararları ve tarafların kontrolü dışındaki benzer hâllerde hizmetin verilememesi mücbir sebep sayılır; bu hâllerde taraflardan hiçbiri diğerine karşı kusurlu sayılmaz.",
      "Mücbir sebep hâlinde taraflar, hizmetin başka bir tarihe aktarılması veya bedelin iadesi seçeneklerinden birini birlikte belirler.",
    ],
  });

  // 10 — Fesih
  const fesihParas: string[] = [];
  if (d.mod === "donem") {
    fesihParas.push(
      d.fesihGun.trim()
        ? `Taraflar, dönem sözleşmesini en az ${d.fesihGun.trim()} gün önceden yazılı bildirimde bulunmak kaydıyla feshedebilir.`
        : "Taraflar, dönem sözleşmesini makul bir süre öncesinde yazılı bildirimde bulunmak kaydıyla feshedebilir.",
    );
    fesihParas.push(
      "Fesih bildirimine rağmen, bildirim tarihinden önce ACENTE tarafından satışı yapılmış ve TAŞIYICI'ya bildirilmiş seferler, taraflarca aksi kararlaştırılmadıkça yerine getirilir.",
    );
  } else {
    fesihParas.push(
      "İşbu sözleşme, konusu olan seferin tamamlanması ve bedelin ödenmesi ile sona erer.",
    );
  }
  fesihParas.push(
    "Tarafların yükümlülüklerini esaslı biçimde ihlal etmesi hâlinde karşı taraf sözleşmeyi derhâl feshedebilir; doğan zararlara ilişkin talep hakları saklıdır.",
  );
  out.push({ baslik: d.mod === "donem" ? "Sözleşmenin Süresi ve Feshi" : "Sözleşmenin Sona Ermesi", paragraflar: fesihParas });

  // 11 — Ek koşullar (opsiyonel)
  if (d.ekKosullar.trim()) {
    out.push({ baslik: "Ek Koşullar", paragraflar: d.ekKosullar.trim().split(/\n+/).filter(Boolean) });
  }

  // 12 — Yürürlük
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
      ].filter(Boolean).join(" "),
      "Taraflar arasındaki uyuşmazlıklarda ilgili mevzuat hükümleri uygulanır.",
    ],
  });

  return out.map((s, i) => ({ ...s, no: i + 1 }));
}

export function signatureBlocks(d: TransferData): SignatureBlock[] {
  return [
    { rol: "ACENTE", isim: d.acenteUnvan || "…", altNot: d.acenteYetkili || undefined },
    { rol: "TAŞIYICI", isim: d.tasiyiciUnvan || "…" },
  ];
}

export function transferSpec(d: TransferData): DocSpec {
  return {
    baslik: DOC_TITLE,
    ustNot: LAWYER_NOTE_TOP,
    bolumler: buildTransferSections(d),
    imzalar: signatureBlocks(d),
    altNot: LAWYER_NOTE_BOTTOM,
    markaSatiri: BRAND_LINE,
  };
}
