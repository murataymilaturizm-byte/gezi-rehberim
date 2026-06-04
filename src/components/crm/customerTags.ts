// CRM otomatik etiket sistemi (client-side, backend yazma YOK).
// Pricing'de vaad edilen "Akıllı CRM — Otomatik etiketleme" özelliğinin
// UI tarafı: her müşteri için segment (VIP/Müşteri/Potansiyel) +
// aktivite (Aktif/İnaktif) etiketlerini mevcut DB verisinden türetir.
//
// İki boyut paralel — bir müşteri aynı anda "VIP" + "İnaktif" olabilir
// (uzun süredir sessiz VIP, kazanılması kritik). Mutex DEĞİL.

export type AutoTagKey = "vip" | "customer" | "prospect" | "active" | "inactive" | "lead";

export interface ProfileForTagging {
  total_bookings: number;
  total_spent: number;
  total_messages: number;
  last_search_query: string | null;
  last_interaction_at: string;
  source?: string | null;
}

// Eşik değerleri: rezervasyon-bazlı segment, currency-agnostic.
// "Yüksek harcama" muğlak ve döviz bağımlı — bu turda sadece rezervasyon
// sayısına dayanıyoruz; total_spent öne çıkar ama segment için sayım esas.
export const VIP_BOOKING_THRESHOLD = 3;
export const PROSPECT_MESSAGE_THRESHOLD = 5;
export const ACTIVE_DAYS = 7;
export const INACTIVE_DAYS = 60;

export function computeAutoTags(p: ProfileForTagging): AutoTagKey[] {
  const tags: AutoTagKey[] = [];

  // Boyut 1: Segment (mutually exclusive)
  if (p.total_bookings >= VIP_BOOKING_THRESHOLD) {
    tags.push("vip");
  } else if (p.total_bookings >= 1) {
    tags.push("customer");
  } else if (p.source === "manual") {
    // CRM'e acente tarafından eklenmiş, henüz rezervasyonu yok → Lead
    // (Prospect ile farkı: prospect WhatsApp'tan gelmiş, lead manuel girilmiş)
    tags.push("lead");
  } else if (p.total_messages >= PROSPECT_MESSAGE_THRESHOLD || !!p.last_search_query) {
    tags.push("prospect");
  }

  // Boyut 2: Aktivite (mutually exclusive, segment'ten bağımsız)
  // Manuel müşteri henüz mesajlaşmadıysa aktivite etiketi atama —
  // first_interaction_at = created_at ama "aktif" anlamlı değil.
  if (p.source !== "manual" || p.total_messages > 0) {
    const daysSinceLast =
      (Date.now() - new Date(p.last_interaction_at).getTime()) / 86_400_000;
    if (daysSinceLast <= ACTIVE_DAYS) {
      tags.push("active");
    } else if (daysSinceLast > INACTIVE_DAYS) {
      tags.push("inactive");
    }
  }

  return tags;
}

// Renk tonları — site krem+turuncu paletiyle uyumlu, çok parlak değil.
// light/dark her ikisinde okunaklı. CSS class string'leri olarak verilir
// ki Tailwind purge bunları doğrudan görebilsin.
export const AUTO_TAG_STYLES: Record<
  AutoTagKey,
  { bg: string; text: string; border: string; icon: string }
> = {
  vip: {
    bg: "bg-yellow-500/15 dark:bg-yellow-500/20",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-500/40",
    icon: "🏆",
  },
  customer: {
    bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/40",
    icon: "✓",
  },
  prospect: {
    bg: "bg-blue-500/15 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/40",
    icon: "✨",
  },
  active: {
    bg: "bg-teal-500/15 dark:bg-teal-500/20",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-500/40",
    icon: "⚡",
  },
  inactive: {
    bg: "bg-muted/60",
    text: "text-muted-foreground",
    border: "border-border",
    icon: "💤",
  },
  lead: {
    bg: "bg-purple-500/15 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/40",
    icon: "🌱",
  },
};

// Manuel etiket — nötr ama hafif turuncu accent (site kimliği)
export const MANUAL_TAG_STYLE = {
  bg: "bg-secondary/30 dark:bg-secondary/20",
  text: "text-secondary-foreground",
  border: "border-secondary/50",
};

// i18n key haritalama (label çevirisi için)
export const AUTO_TAG_I18N_KEYS: Record<AutoTagKey, string> = {
  vip: "admin.whatsapp.userProfiles.autoTags.vip",
  customer: "admin.whatsapp.userProfiles.autoTags.customer",
  prospect: "admin.whatsapp.userProfiles.autoTags.prospect",
  active: "admin.whatsapp.userProfiles.autoTags.active",
  inactive: "admin.whatsapp.userProfiles.autoTags.inactive",
  lead: "admin.whatsapp.userProfiles.autoTags.lead",
};
