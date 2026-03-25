// Tour category definitions
export const TOUR_CATEGORIES = [
  { value: "kultur", label: "Kültür & Tarih", icon: "🏛️", international: false },
  { value: "doga", label: "Doğa & Ekoturizm", icon: "🌿", international: false },
  { value: "termal", label: "Termal & Sağlık", icon: "♨️", international: false },
  { value: "kayak", label: "Kayak & Kış Sporları", icon: "⛷️", international: false },
  { value: "deniz", label: "Deniz & Tekne", icon: "⛵", international: false },
  { value: "festival", label: "Festival & Etkinlik", icon: "🎉", international: false },
  { value: "alisveris", label: "Alışveriş & Gastro", icon: "🛍️", international: false },
  { value: "yurtdisi", label: "Yurt Dışı", icon: "✈️", international: true },
  { value: "hac_umre", label: "Hac & Umre", icon: "🕋", international: true },
  { value: "gemi", label: "Gemi & Kruvaziyer", icon: "🚢", international: true },
] as const;

export type TourCategoryValue = typeof TOUR_CATEGORIES[number]["value"];

export const isInternationalCategory = (category: string): boolean => {
  const cat = TOUR_CATEGORIES.find(c => c.value === category);
  return cat?.international ?? false;
};
