// ═══════════════════════════════════════════════════════════════════════════
// MİKRO-D2 (2026-08-01): "YENİ KOLON ↔ AÇIK SELECT-LİSTESİ" SINIFININ SONU
//
// Sınıf ÜÇ kez tekrarladı, hepsi aynı şekilde: DB'ye kolon eklendi, kod onu
// okudu, ama veriyi çeken AÇIK SELECT listesine eklenmedi → alan sessizce
// undefined geldi ve özellik hiç çalışmadı (hata YOK, log YOK):
//   1) notify_new_lead        — dispatch: acente toggle'ı kapatsa bile gönderim
//   2) software_inquiry_enabled — demo-chat: bayrak DB'de açıkken tetiklenmedi
//   3) language_preference    — demo-chat: KÖK-B yedeği hiç devreye giremiyordu
//      (bu envanterde bulundu; iki acentede de değer 'tr' olduğu için görünmemişti)
//
// ÇÖZÜM: botun DAVRANIŞINI belirleyen kolonlar TEK KAYNAK. Yeni davranış-kolonu
// eklerken TEK yer değişir; ayrıca scripts/test_behavioral.ts'teki muhafız,
// shared/ içinde okunan HER `agency.<kolon>` alanının bu listede olmasını
// zorunlu kılar → listeye eklemeyi unutmak DERLEME değil TEST hatası verir.
//
// ⚠️ BURAYA YALNIZ BOT-DAVRANIŞI KOLONLARI GİRER. Meta token'ları,
//    lemonsqueezy kimlikleri, abonelik alanları vb. GİRMEZ — onları çeken dar
//    SELECT'ler (id/user_id/meta_waba_id …) kasıtlı olarak dar kalmalı.
// ═══════════════════════════════════════════════════════════════════════════

export const AGENCY_BEHAVIOR_COLUMNS: readonly string[] = [
  "id",
  "name",
  "city",
  "address",
  "phone_public",
  "website_url",
  "working_hours",
  "maps_url",
  "cancellation_policy",
  "description",
  "payment_instructions",
  "primary_currency",
  "language_currencies",
  "language_preference",      // KÖK-B: zayıf dil-sinyalinde acente varsayılanı
  "collect_email",
  "show_multi_currency",
  "conversation_style",
  "enabled_languages",
  "software_inquiry_enabled", // W5: yazılım-talebi yakalama bayrağı
];

/** PostgREST .select() için hazır dizge. */
export const AGENCY_SELECT: string = AGENCY_BEHAVIOR_COLUMNS.join(", ");

/**
 * `agency.<isim>` biçiminde okunan ama KOLON OLMAYAN adlar — muhafız bunları
 * yok sayar. (Örn. dosya-yolu/yorum kaynaklı yanlış eşleşmeler.)
 */
export const AGENCY_NON_COLUMN_PROPS: readonly string[] = ["ts"];
