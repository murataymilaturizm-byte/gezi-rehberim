import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, BarChart3 } from "lucide-react";

const schema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Manuel WhatsApp vs Turzz AI Chatbot — Detaylı Karşılaştırma",
  "description": "Seyahat acenteleri için manuel WhatsApp kullanımı ile Turzz AI chatbot arasındaki fark. Maliyet, zaman ve satış performansı karşılaştırması.",
  "author": { "@type": "Organization", "name": "Turzz AI" },
  "publisher": { "@type": "Organization", "name": "Turzz AI", "url": "https://turzzai.com" },
  "datePublished": "2026-05-07",
};

const rows = [
  { konu: "Yanıt süresi", manuel: ["Ortalama 4-8 saat", false], turzz: ["Saniyeler içinde", true] },
  { konu: "Gece/hafta sonu hizmet", manuel: ["Yok", false], turzz: ["7/24 aktif", true] },
  { konu: "Aynı anda kaç müşteri", manuel: ["1 (sırayla)", false], turzz: ["Sınırsız", true] },
  { konu: "Dil desteği", manuel: ["1-2 dil (bildiğiniz)", false], turzz: ["7 dil otomatik", true] },
  { konu: "Rezervasyon süreci", manuel: ["Manuel, hata riski", false], turzz: ["Otomatik, sistematik", true] },
  { konu: "Kontenjan takibi", manuel: ["Excel/not defteri", false], turzz: ["Anlık, otomatik", true] },
  { konu: "Müşteri geçmiş takibi", manuel: ["Yok/zor", false], turzz: ["Otomatik profil", true] },
  { konu: "Hatırlatma gönderimi", manuel: ["Manuel, unutulabilir", false], turzz: ["Otomatik programlanmış", true] },
  { konu: "Aylık maliyet (1 kişi)", manuel: ["15.000-20.000₺ maaş", false], turzz: ["2.999₺'dan başlayan", true] },
  { konu: "Kurulum süresi", manuel: ["Hemen (ama verimlilik yok)", false], turzz: ["5-10 dakika", true] },
  { konu: "Raporlama", manuel: ["Excel, zaman alıcı", false], turzz: ["Anlık dashboard", true] },
  { konu: "Ölçekleme", manuel: ["Yeni çalışan gerekir", false], turzz: ["Plan yükseltme yeterli", true] },
];

export default function TurzzVsManuel() {
  return (
    <Layout>
      <SEOHead
        title="Manuel WhatsApp vs Turzz AI Chatbot — Karşılaştırma"
        description="Seyahat acentenizde manuel WhatsApp kullanımı mı yoksa chatbot mu? Detaylı karşılaştırma: maliyet, zaman, verimlilik, satış performansı."
        keywords="whatsapp business vs chatbot, manuel whatsapp karşılaştırma, whatsapp chatbot fark, turizm chatbot avantajları, whatsapp bot mü manuel mi"
        canonical="/karsilastir/turzz-vs-manuel-whatsapp"
        schema={schema}
        type="article"
      />

      <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50/50 to-background dark:from-slate-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-slate-100 text-slate-700 border-0">
            <BarChart3 className="w-3 h-3 mr-1" /> Karşılaştırma
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Manuel WhatsApp vs{" "}
            <span className="text-orange-500">Turzz AI</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Seyahat acentenizde hangi yöntem daha verimli? Maliyet, zaman ve satış performansı
            açısından objektif karşılaştırma.
          </p>
        </div>
      </section>

      {/* Karşılaştırma Tablosu */}
      <section className="py-16 container mx-auto px-4 max-w-4xl">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">
          12 Kritik Faktörde Karşılaştırma
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-card rounded-xl overflow-hidden shadow-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-4 text-sm font-semibold text-foreground">Konu</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">❌ Manuel WhatsApp</th>
                <th className="text-center p-4 text-sm font-semibold text-orange-500">✅ Turzz AI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="p-4 text-sm font-medium text-foreground">{row.konu}</td>
                  <td className="p-4 text-sm text-center">
                    <div className="flex items-center justify-center gap-1">
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="text-muted-foreground">{row.manuel[0] as string}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-foreground font-medium">{row.turzz[0] as string}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Maliyet Hesabı */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            Gerçek Maliyet Hesabı
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl p-6">
              <h3 className="font-bold text-foreground mb-4">❌ Manuel WhatsApp (Yıllık)</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Çalışan maaşı (1 kişi)", "180.000₺"],
                  ["SGK ve ek maliyetler", "54.000₺"],
                  ["Eğitim ve zaman kaybı", "12.000₺"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-foreground">{v}</span>
                  </div>
                ))}
                <div className="border-t border-red-200 pt-2 flex justify-between font-bold">
                  <span className="text-foreground">Toplam</span>
                  <span className="text-red-500">246.000₺/yıl</span>
                </div>
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-xl p-6">
              <h3 className="font-bold text-foreground mb-4">✅ Turzz AI (Yıllık)</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Profesyonel Plan (aylık 4.999₺)", "59.988₺"],
                  ["Kurulum ve öğrenme", "0₺"],
                  ["Ek destek/bakım", "0₺"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-foreground">{v}</span>
                  </div>
                ))}
                <div className="border-t border-green-200 pt-2 flex justify-between font-bold">
                  <span className="text-foreground">Toplam</span>
                  <span className="text-green-500">59.988₺/yıl</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-muted-foreground mt-6 text-sm">
            Turzz AI ile yıllık <strong className="text-foreground">~186.000₺</strong> tasarruf potansiyeli.
          </p>
        </div>
      </section>

      {/* Sonuç */}
      <section className="py-16 container mx-auto px-4 max-w-3xl text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">Sonuç</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Manuel WhatsApp yönetimi, seyahat acentelerinin büyümesini engelleyen en büyük
          faktörlerden biri. 7/24 yanıt veremeyen, dil bariyeriyle mücadele eden ve
          tekrarlayan işlere zaman harcayan acenteler rekabette geri kalıyor.
        </p>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Turzz AI bu sorunların tamamını çözüyor — ve maliyeti, eleman maaşının
          yalnızca <strong className="text-foreground">%25'i</strong>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
            <Link to="/auth?mode=signup">14 Gün Ücretsiz Dene</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/whatsapp-chatbot-seyahat-acentesi">Chatbot Özelliklerini İncele</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
