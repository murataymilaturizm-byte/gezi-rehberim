// B3 anket cevap-yakalama (2026-07-10) — FSM-ÖNCESİ, çakışma-guard'lı.
//
// Akış (webhook, process-message'DEN ÖNCE):
//   1. AKTİF TOPLAMA AKIŞI VARSA → tamamen pas (pax "3" puan sanılmaz).
//   2. Müşterinin AÇIK pending-feedback penceresi (feedback_sent_at + 72h,
//      henüz tour_feedback yok) yoksa → pas.
//   3. Mesaj puan-deseni değilse → pas (normal akış; pencere içinde tekrar denenebilir).
//   4. Puan → tour_feedback UPSERT + 7-dil teşekkür + (rating<=2) low_rating complaint.
//
// AR/Farsça rakamlar burada ASCII'ye normalize edilir (٥→5) — parseRating ASCII bekler.
import { parseRating } from "../../shared/constants/rating-words.ts";
import { sendWhatsAppMessage } from "../../_shared/metaWhatsapp.ts";
import { phoneMatchVariants } from "../../_shared/phone.ts";

// GİRİŞ-NOKTASI AR-rakam normalizasyonu (process-message.ts ile aynı kural).
function normalizeDigits(s: string): string {
  return (s || "").replace(/[٠-٩۰-۹]/g, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

function maskPhone(p: string): string {
  const s = String(p || "");
  return s.length <= 4 ? "***" : "***" + s.slice(-4);
}

const THANKS: Record<string, string> = {
  tr: "Değerlendirmeniz için çok teşekkürler! ⭐ Görüşleriniz bizim için değerli.",
  en: "Thank you so much for your feedback! ⭐ Your opinion means a lot to us.",
  de: "Vielen Dank für Ihre Bewertung! ⭐ Ihre Meinung ist uns sehr wichtig.",
  fr: "Merci beaucoup pour votre évaluation ! ⭐ Votre avis compte beaucoup pour nous.",
  es: "¡Muchas gracias por su valoración! ⭐ Su opinión es muy valiosa para nosotros.",
  ru: "Большое спасибо за вашу оценку! ⭐ Ваше мнение очень важно для нас.",
  ar: "شكراً جزيلاً على تقييمك! ⭐ رأيك يهمنا كثيراً.",
};

// rating<=2 ek cümle (acente iletişim + ilgilenilecek).
function lowRatingSuffix(lang: string, phone: string | null): string {
  const ph = phone ? ` 📞 ${phone}` : "";
  const m: Record<string, string> = {
    tr: `\n\nMemnun kalmadığınız için üzgünüz. En kısa sürede sizinle ilgileneceğiz.${ph}`,
    en: `\n\nWe're sorry you weren't satisfied. We'll get in touch with you shortly.${ph}`,
    de: `\n\nEs tut uns leid, dass Sie nicht zufrieden waren. Wir melden uns in Kürze bei Ihnen.${ph}`,
    fr: `\n\nNous sommes désolés que vous n'ayez pas été satisfait. Nous vous contacterons sous peu.${ph}`,
    es: `\n\nLamentamos que no haya quedado satisfecho. Nos pondremos en contacto pronto.${ph}`,
    ru: `\n\nСожалеем, что вы остались недовольны. Мы свяжемся с вами в ближайшее время.${ph}`,
    ar: `\n\nنأسف لعدم رضاك. سنتواصل معك في أقرب وقت.${ph}`,
  };
  return m[lang] || m.tr;
}

interface CaptureDeps {
  supabase: any;
  agency: any;
  userPhone: string;
  rawMessage: string;
  /** preloaded conversation context (JSON string) — aktif-akış guard'ı için. */
  preloadedContext: string | null;
  meta: { phoneNumberId: string; accessToken: string };
  lang: string;
}

/** true dönerse mesaj YAKALANDI (process-message ÇAĞRILMAMALI). */
export async function tryCaptureFeedback(deps: CaptureDeps): Promise<boolean> {
  const { supabase, agency, userPhone, rawMessage, preloadedContext, meta, lang } = deps;

  // 1) AKTİF TOPLAMA AKIŞI GUARD — çakışma koruması (KRİTİK).
  if (preloadedContext) {
    try {
      const ctx = JSON.parse(preloadedContext);
      const stage = ctx?.stage;
      const step = ctx?.collectionStep;
      // Toplama/onay akışı açık → puan yakalama TAMAMEN pas.
      if (step || stage === "COLLECTING_INFO" || stage === "CONFIRMING" || stage === "TOUR_SELECTED" || stage === "BROWSING") {
        return false;
      }
    } catch { /* parse edilemezse guard'ı geç, aşağıdaki pencere zaten dar */ }
  }

  // 2) PENDING-FEEDBACK PENCERESİ: feedback_sent_at son 72h + henüz feedback yok.
  // registrations.phone HAM saklanır (0541.. / +90.. karışık) — kanonik userPhone'un
  // tüm eşdeğer biçimleriyle eşleştir (İş1: registrations.phone'a DOKUNMA).
  const phoneVariants = phoneMatchVariants(userPhone);
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: pendingRegs } = await supabase
    .from("registrations")
    .select("id, phone, feedback_sent_at")
    .eq("agency_id", agency.id)
    .in("phone", phoneVariants)
    .gte("feedback_sent_at", since)
    .order("feedback_sent_at", { ascending: false })
    .limit(1);

  const reg = pendingRegs?.[0];
  if (!reg) return false; // pencere yok → pas

  // 3) PUAN-DESENİ (AR-rakam normalize sonrası).
  const normMsg = normalizeDigits(rawMessage);
  const parsed = parseRating(normMsg);
  if (!parsed) return false; // desen değil → normal akış (pencere içinde tekrar denenebilir)

  // 4) UPSERT tour_feedback (reg başına TEK; ikinci puan → UPDATE + yorum append).
  const { data: existing } = await supabase
    .from("tour_feedback")
    .select("id, comment")
    .eq("registration_id", reg.id)
    .maybeSingle();

  if (existing) {
    const mergedComment = [existing.comment, parsed.comment].filter(Boolean).join(" | ") || null;
    await supabase.from("tour_feedback")
      .update({ rating: parsed.rating, comment: mergedComment, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("tour_feedback").insert({
      agency_id: agency.id,
      registration_id: reg.id,
      customer_phone: userPhone,
      rating: parsed.rating,
      comment: parsed.comment,
    });
  }
  console.log(`[feedback-capture] KAYIT reg=${reg.id.slice(0, 8)} rating=${parsed.rating} phone=${maskPhone(userPhone)} comment=${parsed.comment ? "var" : "yok"}`);

  // CRM timeline: whatsapp_user_profiles.feedback_score/comment → ActivityTimeline
  // 'feedback_received' event'i ("⭐ 5 — yorum") otomatik gösterir (frontend değişmez).
  supabase.from("whatsapp_user_profiles")
    .update({ feedback_score: parsed.rating, feedback_comment: parsed.comment })
    .in("phone", phoneVariants).eq("agency_id", agency.id)
    .then(() => {}, () => {});

  // 5) Düşük puan → complaints(low_rating) (J-14 deseni; acente bildirilir).
  if (parsed.rating <= 2) {
    supabase.from("complaints").insert({
      agency_id: agency.id,
      phone: userPhone,
      message: `DÜŞÜK PUAN (${parsed.rating}/5)${parsed.comment ? ` — "${parsed.comment}"` : ""} | Rezervasyon: ${reg.id}`,
      type: "low_rating",
      status: "new",
    }).then(() => {}, () => {});
  }

  // 6) 7-dil teşekkür (+ düşük-puan ek cümlesi).
  let reply = THANKS[lang] || THANKS.tr;
  if (parsed.rating <= 2) reply += lowRatingSuffix(lang, agency.phone_public || null);
  await sendWhatsAppMessage(meta.phoneNumberId, meta.accessToken, userPhone, reply);
  // Konuşma kaydı (opsiyonel görünürlük)
  supabase.from("whatsapp_conversations").insert([
    { phone: userPhone, role: "user", content: rawMessage, agency_id: agency.id },
    { phone: userPhone, role: "assistant", content: reply, agency_id: agency.id },
  ]).then(() => {}, () => {});

  return true; // YAKALANDI
}
