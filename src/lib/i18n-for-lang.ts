// SEO Dalga 2a: belirli bir dil için BAĞIMSIZ i18n örneği. Çeviri deposu global örnekle
// paylaşılır, DİL DURUMU kopyanındır → global örnek hiç değiştirilmez. Prerender
// eşzamanlı (vite-react-ssg concurrency 20) olduğu için sayfalar birbirinin dilini alamaz.
import i18n from "@/i18n";

export function i18nForLang(lang: string) {
  return i18n.cloneInstance({ lng: lang, initAsync: false });
}
