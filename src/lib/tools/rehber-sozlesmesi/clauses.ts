// ARAÇ-1 / Rehber Sözleşmesi — MADDE METİNLERİ TEK KAYNAĞI (TR).
//
// KURALLAR:
// 1. Belge TR'dir (Türkiye hukuku, TR taraflar). Sayfa arayüzü çok-dilli olabilir,
//    sözleşme metni tek dildir — çeviri iddiası hukuki risk üretir.
// 2. Opsiyonel alan boşsa İLGİLİ CÜMLE veya MADDE tamamen düşer.
//    Belgede "[...]", "___" veya boş parantez ASLA kalmaz (davranışsal testle kilitli).
// 3. Madde numaraları düşen maddelerden sonra kayar — numaralandırma render anında yapılır.
// 4. Metin "örnek iskelet" dilindedir; kesin hukuki hüküm iddiası taşımaz.

import type { ContractData } from "./schema";
import { EXPENSE_ITEMS } from "./schema";

export const BRAND_LINE = "Bu belge turzzai.com araçlarıyla oluşturulmuştur.";
export const LAWYER_NOTE_TOP =
  "Bu metin örnek bir iskelettir; imzalamadan önce hukuk danışmanınıza inceletmeniz önerilir.";
export const LAWYER_NOTE_BOTTOM =
  "Bilgilendirme amaçlıdır, hukuki danışmanlık değildir. Güncel mevzuata ve kendi ticari koşullarınıza göre uyarlayınız.";

export const DOC_TITLE = "TUR REHBERLİĞİ HİZMET SÖZLEŞMESİ";

export interface RenderedClause {
  no: number;
  baslik: string;
  /** Paragraflar — her biri ayrı <p> / Word paragrafı olur */
  paragraflar: string[];
}

const has = (v?: string) => !!String(v ?? "").trim();
const trim = (v?: string) => String(v ?? "").trim();

/** ISO tarihi TR biçimine çevirir; geçersizse ham değeri döner */
export function trDate(iso?: string): string {
  const s = trim(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

const CUR_LABEL: Record<string, string> = { TRY: "TL", EUR: "EUR", USD: "USD" };
const BASIS_LABEL: Record<string, string> = {
  tur: "tur başına", gun: "gün başına", saat: "saat başına",
};

function feeSentence(d: ContractData): string {
  const tutar = trim(d.ucretTutar);
  const birim = CUR_LABEL[d.ucretParaBirimi] || d.ucretParaBirimi;
  const baz = BASIS_LABEL[d.ucretBazi] || "";
  return `Acente, işbu sözleşme konusu rehberlik hizmeti karşılığında Rehber'e ${baz} ${tutar} ${birim} ödemeyi kabul eder. Belirtilen tutar brüt olup, yasal kesintiler ve vergisel yükümlülükler tarafların tabi olduğu mevzuata göre uygulanır.`;
}

function paymentSentence(d: ContractData): string {
  const gun = trim(d.odemeGun);
  const yontem =
    d.odemeYontemi === "banka"
      ? has(d.rehberIban)
        ? ` Ödeme, Rehber'in ${trim(d.rehberIban)} IBAN numaralı banka hesabına yapılır.`
        : " Ödeme, Rehber'in bildireceği banka hesabına yapılır."
      : d.odemeYontemi === "nakit"
        ? " Ödeme nakit olarak yapılır ve karşılığında yazılı belge düzenlenir."
        : "";
  if (d.odemeZamani === "pesin") {
    return `Ücret, hizmetin başlangıcından önce peşin olarak ödenir.${yontem}`;
  }
  if (d.odemeZamani === "kismi") {
    return `Ücretin bir kısmı hizmetin başlangıcında, kalan kısmı hizmetin tamamlanmasını izleyen${gun ? ` ${gun}` : ""} gün içinde ödenir.${yontem}`;
  }
  return `Ücret, hizmetin tamamlanmasını izleyen${gun ? ` ${gun}` : ""} gün içinde ödenir.${yontem}`;
}

/**
 * Sözleşme maddelerini üretir. Dönen dizi YALNIZ dahil edilen maddeleri içerir;
 * numaralar burada verilir (düşen madde numarayı boşta bırakmaz).
 */
export function buildClauses(d: ContractData): RenderedClause[] {
  const out: Array<{ baslik: string; paragraflar: string[] }> = [];

  // ── 1. TARAFLAR ──────────────────────────────────────────────────────────
  {
    const acenteSatir: string[] = [`Unvan: ${trim(d.acenteUnvan)}`, `Adres: ${trim(d.acenteAdres)}`];
    if (has(d.acenteVergi)) acenteSatir.push(`Vergi dairesi / numarası: ${trim(d.acenteVergi)}`);
    if (has(d.acenteTursab)) acenteSatir.push(`TÜRSAB belge numarası: ${trim(d.acenteTursab)}`);
    acenteSatir.push(`Yetkili: ${trim(d.acenteYetkili)}`);

    const rehberSatir: string[] = [`Ad-soyad: ${trim(d.rehberAd)}`];
    if (has(d.rehberKartNo)) rehberSatir.push(`Ruhsat / çalışma kartı numarası: ${trim(d.rehberKartNo)}`);
    rehberSatir.push(`Adres: ${trim(d.rehberAdres)}`);
    if (has(d.rehberTelefon)) rehberSatir.push(`Telefon: ${trim(d.rehberTelefon)}`);

    out.push({
      baslik: "Taraflar",
      paragraflar: [
        "İşbu sözleşme, aşağıda bilgileri yer alan taraflar arasında düzenlenmiştir.",
        `ACENTE — ${acenteSatir.join("; ")}.`,
        `REHBER — ${rehberSatir.join("; ")}.`,
        "Sözleşme metninde Acente ve Rehber ayrı ayrı \"Taraf\", birlikte \"Taraflar\" olarak anılır.",
      ],
    });
  }

  // ── 2. SÖZLEŞMENİN KONUSU ────────────────────────────────────────────────
  {
    const p: string[] = [];
    let konu = `İşbu sözleşmenin konusu, Acente tarafından düzenlenen "${trim(d.turAdi)}" adlı tur kapsamında Rehber'in vereceği tur rehberliği hizmetinin kapsamı, süresi, ücreti ve tarafların karşılıklı hak ve yükümlülüklerinin belirlenmesidir.`;
    p.push(konu);
    if (has(d.guzergah)) p.push(`Turun güzergâhı ve kapsamı: ${trim(d.guzergah)}.`);
    if (d.diller.length > 0) {
      p.push(`Rehberlik hizmeti ${d.diller.join(", ")} dil(ler)inde verilecektir.`);
    }
    if (has(d.grupBuyuklugu)) {
      p.push(`Hizmetin verileceği grubun tahmini büyüklüğü ${trim(d.grupBuyuklugu)} kişidir. Grup büyüklüğünde esaslı değişiklik olması hâlinde Taraflar durumu yazılı olarak yeniden değerlendirir.`);
    }
    out.push({ baslik: "Sözleşmenin Konusu", paragraflar: p });
  }

  // ── 3. SÜRE VE GÖREV TAKVİMİ ─────────────────────────────────────────────
  {
    const p: string[] = [
      `Rehberlik hizmeti ${trDate(d.baslangicTarihi)} tarihinde başlar ve ${trDate(d.bitisTarihi)} tarihinde sona erer.`,
    ];
    if (has(d.calismaSuresi)) {
      p.push(`Günlük çalışma düzeni: ${trim(d.calismaSuresi)}. Bu sürenin aşılmasını gerektiren hâllerde Taraflar ek ücret veya telafi konusunda yazılı olarak anlaşır.`);
    }
    p.push("Program değişikliği gerektiren durumlarda Acente, değişikliği makul süre içinde Rehber'e bildirir.");
    out.push({ baslik: "Süre ve Görev Takvimi", paragraflar: p });
  }

  // ── 4. REHBERİN YÜKÜMLÜLÜKLERİ ───────────────────────────────────────────
  {
    const p: string[] = [
      "Rehber, hizmeti mesleki özen ve dikkatle, mevzuata ve meslek kurallarına uygun biçimde yerine getirir.",
      "Rehber, tur programında belirtilen buluşma yeri ve saatinde hazır bulunur; programın aksamasına yol açacak durumları derhâl Acente'ye bildirir.",
      "Rehber, katılımcıların güvenliğini gözetir ve olağandışı durumlarda Acente'yi bilgilendirir.",
    ];
    if (has(d.rehberKartNo)) {
      p.push("Rehber, mesleki faaliyetini yürütmek için gerekli belgelerin geçerliliğini sözleşme süresince korumakla yükümlüdür.");
    }
    out.push({ baslik: "Rehber'in Yükümlülükleri", paragraflar: p });
  }

  // ── 5. ACENTENİN YÜKÜMLÜLÜKLERİ ──────────────────────────────────────────
  out.push({
    baslik: "Acente'nin Yükümlülükleri",
    paragraflar: [
      "Acente, tur programını, katılımcı listesini ve hizmetin ifası için gerekli bilgileri makul süre öncesinde Rehber'e iletir.",
      "Acente, sözleşmede kararlaştırılan ücreti belirlenen zamanda ve biçimde öder.",
      "Acente, programda kendi sorumluluğunda olan organizasyon unsurlarının (ulaşım, konaklama, giriş düzenlemeleri vb.) sağlanmasından sorumludur.",
    ],
  });

  // ── 6. ÜCRET VE ÖDEME ────────────────────────────────────────────────────
  out.push({
    baslik: "Ücret ve Ödeme",
    paragraflar: [feeSentence(d), paymentSentence(d)],
  });

  // ── 7. MASRAFLAR (opsiyonel — hiçbir kalem işaretlenmemişse madde DÜŞER) ──
  {
    const secili = EXPENSE_ITEMS.filter((it) => has(d.masraflar[it.key]));
    if (secili.length > 0) {
      const acenteler = secili.filter((it) => d.masraflar[it.key] === "acente").map((it) => it.label.toLocaleLowerCase("tr-TR"));
      const rehberler = secili.filter((it) => d.masraflar[it.key] === "rehber").map((it) => it.label.toLocaleLowerCase("tr-TR"));
      const p: string[] = [];
      if (acenteler.length) p.push(`Aşağıdaki masraf kalemleri Acente'ye aittir: ${acenteler.join(", ")}.`);
      if (rehberler.length) p.push(`Aşağıdaki masraf kalemleri Rehber'e aittir: ${rehberler.join(", ")}.`);
      p.push("Sözleşmede sayılmayan masraf kalemleri, doğduğu anda Taraflarca yazılı olarak kararlaştırılır.");
      out.push({ baslik: "Masraflar", paragraflar: p });
    }
  }

  // ── 8. İPTAL VE DEĞİŞİKLİK ───────────────────────────────────────────────
  {
    const p: string[] = [];
    // Acente kaynaklı iptal
    if (has(d.acenteIptalGun) || d.acenteIptalUcret) {
      const gunPart = has(d.acenteIptalGun)
        ? `hizmetin başlangıcından en az ${trim(d.acenteIptalGun)} gün önce yazılı bildirimde bulunması hâlinde`
        : "yazılı bildirimde bulunması hâlinde";
      const ucretPart =
        d.acenteIptalUcret === "tam"
          ? "kararlaştırılan ücretin tamamı Rehber'e ödenir"
          : d.acenteIptalUcret === "kismi"
            ? "kararlaştırılan ücretin Taraflarca yazılı olarak belirlenen kısmı Rehber'e ödenir"
            : d.acenteIptalUcret === "yok"
              ? "Rehber'e ücret ödenmez"
              : "ücret sonucu Taraflarca yazılı olarak belirlenir";
      p.push(`Acente'nin turu iptal etmesi durumunda, ${gunPart} ${ucretPart}. Bildirim süresine uyulmaksızın yapılan iptallerde Taraflar durumu iyiniyet çerçevesinde değerlendirir.`);
    } else {
      p.push("Acente'nin turu iptal etmesi durumunda iptal, Rehber'e yazılı olarak bildirilir ve ücret sonucu Taraflarca değerlendirilir.");
    }
    // Rehber kaynaklı iptal
    const rGun = has(d.rehberIptalGun) ? ` en az ${trim(d.rehberIptalGun)} gün önce` : "";
    let rehberCumle = `Rehber'in hizmeti ifa edememesi durumunda, durumu${rGun} yazılı olarak Acente'ye bildirmesi esastır.`;
    if (d.rehberIkame) {
      rehberCumle += " Rehber, Acente'nin onayı şartıyla, aynı niteliklere sahip bir rehberin yerine görevlendirilmesi için gerekli çabayı gösterir.";
    }
    p.push(rehberCumle);
    p.push("Tur programındaki değişiklikler, hizmetin kapsamını esaslı biçimde etkiliyorsa Taraflarca yazılı olarak yeniden değerlendirilir.");
    out.push({ baslik: "İptal ve Değişiklik", paragraflar: p });
  }

  // ── 9. MÜCBİR SEBEP (opsiyonel) ──────────────────────────────────────────
  if (d.mucbirSebep) {
    out.push({
      baslik: "Mücbir Sebep",
      paragraflar: [
        "Tarafların kontrolü dışında gelişen ve hizmetin ifasını imkânsız kılan olağanüstü hâller (doğal afet, olumsuz hava koşulları, resmî makam kararları, ulaşım yollarının kapanması ve benzeri durumlar) mücbir sebep sayılır.",
        "Mücbir sebep hâlinde etkilenen Taraf, durumu gecikmeksizin diğer Taraf'a bildirir. Bu hâlde Taraflar, hizmetin ertelenmesi, kısmen ifası veya sözleşmenin sona erdirilmesi konusunda iyiniyetle görüşür; ödenmiş tutarların durumu yazılı olarak kararlaştırılır.",
      ],
    });
  }

  // ── 10. YÜRÜRLÜK VE FESİH (EK-1: iptal koşullarından BAĞIMSIZ madde) ─────
  if (d.yururlukFesih) {
    const bildirim = has(d.fesihBildirimGun)
      ? `en az ${trim(d.fesihBildirimGun)} gün önce yazılı bildirimde bulunmak suretiyle`
      : "yazılı bildirimde bulunmak suretiyle";
    out.push({
      baslik: "Yürürlük ve Fesih",
      paragraflar: [
        "İşbu sözleşme, Taraflarca imzalandığı tarihte yürürlüğe girer ve sözleşme konusu hizmetin tamamlanmasıyla kendiliğinden sona erer.",
        `Taraflardan her biri, ${bildirim} sözleşmeyi feshedebilir. Fesih hâlinde, fesih tarihine kadar ifa edilmiş hizmetlerin bedeli tasfiye edilir.`,
        "Taraflardan birinin sözleşmeden doğan esaslı yükümlülüklerini yerine getirmemesi ve yazılı uyarıya rağmen aykırılığın giderilmemesi hâlinde, diğer Taraf sözleşmeyi derhâl feshedebilir.",
      ],
    });
  }

  // ── 11. GİZLİLİK VE KİŞİSEL VERİLER (opsiyonel) ─────────────────────────
  if (d.gizlilik) {
    out.push({
      baslik: "Gizlilik ve Kişisel Verilerin Korunması",
      paragraflar: [
        "Taraflar, sözleşme kapsamında öğrendikleri ticari bilgileri ve katılımcılara ait kişisel verileri gizli tutar; bu bilgileri hizmetin ifası dışındaki amaçlarla kullanmaz ve üçüncü kişilerle paylaşmaz.",
        "Kişisel verilerin işlenmesinde Taraflar, ilgili mevzuattan doğan yükümlülüklerine uygun hareket eder. Bu yükümlülük sözleşmenin sona ermesinden sonra da devam eder.",
      ],
    });
  }

  // ── 12. UYUŞMAZLIKLARIN ÇÖZÜMÜ (yer boşsa madde DÜŞER) ──────────────────
  if (has(d.yetkiliYer)) {
    out.push({
      baslik: "Uyuşmazlıkların Çözümü",
      paragraflar: [
        `İşbu sözleşmenin uygulanmasından doğabilecek uyuşmazlıklarda öncelikle iyiniyetli görüşme yolu izlenir; çözüme ulaşılamaması hâlinde ${trim(d.yetkiliYer)} mahkemeleri ve icra daireleri yetkilidir.`,
      ],
    });
  }

  // ── 13. EK KOŞULLAR (boşsa madde DÜŞER) ─────────────────────────────────
  if (has(d.ekKosullar)) {
    out.push({
      baslik: "Ek Koşullar",
      paragraflar: trim(d.ekKosullar).split(/\n+/).map((x) => x.trim()).filter(Boolean),
    });
  }

  // ── 14. SON HÜKÜMLER ────────────────────────────────────────────────────
  {
    const nusha = trim(d.nushaSayisi) || "2";
    const yer = has(d.duzenlemeYeri) ? `${trim(d.duzenlemeYeri)}'de ` : "";
    const tarih = has(d.duzenlemeTarihi) ? `${trDate(d.duzenlemeTarihi)} tarihinde ` : "";
    out.push({
      baslik: "Son Hükümler",
      paragraflar: [
        `İşbu sözleşme ${yer}${tarih}${nusha} nüsha olarak düzenlenmiş ve Taraflarca imza altına alınmıştır. Her Taraf bir nüshayı elinde bulundurur.`,
        "Sözleşmede hüküm bulunmayan hâllerde ilgili mevzuat hükümleri uygulanır. Sözleşmede yapılacak değişiklikler yazılı olarak geçerlidir.",
      ],
    });
  }

  return out.map((c, i) => ({ no: i + 1, ...c }));
}

/** İmza bloğu satırları (belge sonu) */
export function signatureBlocks(d: ContractData): Array<{ rol: string; isim: string }> {
  return [
    { rol: "ACENTE", isim: `${trim(d.acenteUnvan)}${has(d.acenteYetkili) ? ` — ${trim(d.acenteYetkili)}` : ""}` },
    { rol: "REHBER", isim: trim(d.rehberAd) },
  ];
}
