import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MessageCircle, Globe, Clock, TrendingUp, Zap, Users, Bot } from "lucide-react";

const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Turzz AI WhatsApp Chatbot",
  "applicationCategory": "BusinessApplication",
  "description": "Seyahat acenteleri için WhatsApp üzerinden otomatik tur satışı ve rezervasyon yazılımı.",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "2999",
    "priceCurrency": "TRY",
    "priceValidUntil": "2027-01-01"
  },
  "provider": {
    "@type": "Organization",
    "name": "Turzz AI",
    "url": "https://turzzai.com"
  }
};

const ozellikler = [
  { icon: Bot, baslik: "Yapay Zeka Destekli NLU", aciklama: "Müşteri mesajlarını doğal dil işleme ile anlar, doğru soruları sorar." },
  { icon: Globe, baslik: "7 Dil Desteği", aciklama: "Türkçe, İngilizce, Almanca, Rusça, Arapça, Fransızca, İspanyolca." },
  { icon: Clock, baslik: "7/24 Kesintisiz Hizmet", aciklama: "Gece 2'de gelen sorulara bile anında yanıt. Satış fırsatı kaçmaz." },
  { icon: TrendingUp, baslik: "Otomatik Rezervasyon", aciklama: "Tarih, kişi sayısı, isim, telefon bilgilerini adım adım toplar ve rezervasyon oluşturur." },
  { icon: Users, baslik: "Müşteri Profilleri", aciklama: "Her müşterinin geçmişini, tercihlerini ve harcamalarını kayıt altında tutar." },
  { icon: Zap, baslik: "Anlık Bildirimler", aciklama: "Yeni rezervasyon geldiğinde sizi anında haberdar eder." },
];

const karsilastirma = [
  { konu: "Mesaj yanıtlama süresi", manuel: "Ortalama 8 saat", chatbot: "Anlık (saniyeler içinde)" },
  { konu: "Gece yanıtı", manuel: "Yok", chatbot: "7/24 aktif" },
  { konu: "Aynı anda yanıtlanabilen müşteri", manuel: "1", chatbot: "Sınırsız" },
  { konu: "Dil desteği", manuel: "1-2 dil", chatbot: "7 dil" },
  { konu: "Aylık maliyet", manuel: "8.000-15.000 ₺ (çalışan ücreti)", chatbot: "2.999 ₺'dan başlayan" },
];

export default function WhatsAppChatbot() {
  return (
    <Layout>
      <SEOHead
        title="WhatsApp Chatbot Seyahat Acentesi — 7/24 Otomatik Tur Satışı"
        description="Seyahat acenteniz için WhatsApp chatbot. 7 dil desteği, AI destekli rezervasyon sihirbazı, 7/24 otomatik yanıt. Turzz AI ile tur satışlarınızı artırın."
        keywords="whatsapp chatbot seyahat acentesi, tur satışı chatbot, whatsapp bot turizm, otomatik whatsapp yanıt, turizm yazılımı"
        canonical="/whatsapp-chatbot-seyahat-acentesi"
        schema={schema}
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-orange-50/50 to-background dark:from-orange-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-0">
            <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp Chatbot
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            Seyahat Acentenize Özel{" "}
            <span className="text-orange-500">WhatsApp Chatbot</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Müşterileriniz saat 23:00'da tur soruyorsa, Turzz AI anında yanıt veriyor. 7 dil desteği,
            AI destekli rezervasyon sihirbazı ve 7/24 kesintisiz hizmet.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
              <Link to="/auth?mode=signup">14 Gün Ücretsiz Dene</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/">Demo'yu İncele</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">Kredi kartı gerekmez • 5 dakikada kurulum</p>
        </div>
      </section>

      {/* Neden WhatsApp Chatbot */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          Neden Seyahat Acentesi İçin WhatsApp Chatbot?
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Türkiye'deki seyahat acentelerinin büyük çoğunluğu hâlâ WhatsApp mesajlarını
          manuel olarak yanıtlıyor. Bu her geçen dakika kaçan satış demek.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { rakam: "%78", metin: "Türk acentelerinin WhatsApp'ı ana iletişim kanalı olarak kullandığı oran" },
            { rakam: "8 saat", metin: "Manuel yanıtlarda ortalama bekleme süresi — müşteri bu sürede başka acenteye geçiyor" },
            { rakam: "3x", metin: "Chatbot kullanan acentelerin rezervasyon artış oranı (ilk 3 ay)" },
          ].map((item, i) => (
            <Card key={i} className="text-center p-6 border-border/50">
              <CardContent className="pt-0">
                <p className="text-4xl font-bold text-orange-500 mb-2">{item.rakam}</p>
                <p className="text-sm text-muted-foreground">{item.metin}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
            Turzz AI WhatsApp Chatbot Özellikleri
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ozellikler.map((item, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <item.icon className="w-8 h-8 text-orange-500 mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">{item.baslik}</h3>
                  <p className="text-sm text-muted-foreground">{item.aciklama}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır */}
      <section className="py-16 container mx-auto px-4 max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          WhatsApp Chatbot Nasıl Çalışır?
        </h2>
        <p className="text-center text-muted-foreground mb-10">
          Müşteri mesaj atıyor, Turzz AI otomatik olarak tüm rezervasyon sürecini yönetiyor.
        </p>
        <div className="space-y-4">
          {[
            { adim: "1", baslik: "Müşteri WhatsApp'tan Yazıyor", aciklama: "\"Kapadokya balonlu tur var mı?\" gibi doğal bir mesaj atıyor." },
            { adim: "2", baslik: "Chatbot Dili Algılıyor", aciklama: "Türkçe, İngilizce, Almanca... hangi dilde yazarsa aynı dilde yanıtlıyor." },
            { adim: "3", baslik: "Tur Seçeneklerini Gösteriyor", aciklama: "Sistemizdeki müsait turları, tarihleri ve fiyatları otomatik listeliyor." },
            { adim: "4", baslik: "Rezervasyon Bilgilerini Topluyor", aciklama: "Tarih, kişi sayısı, ad-soyad ve telefon numarasını adım adım alıyor." },
            { adim: "5", baslik: "Rezervasyonu Oluşturuyor", aciklama: "Tüm bilgiler alındıktan sonra sisteminize otomatik rezervasyon kaydı düşüyor." },
          ].map((item, i) => (
            <div key={i} className="flex gap-4 p-4 bg-card rounded-lg border border-border/50">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {item.adim}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{item.baslik}</h3>
                <p className="text-sm text-muted-foreground mt-1">{item.aciklama}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Karşılaştırma Tablosu */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
            Manuel WhatsApp vs Turzz AI Chatbot
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-card rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-4 text-sm font-semibold">Konu</th>
                  <th className="text-center p-4 text-sm font-semibold text-muted-foreground">Manuel WhatsApp</th>
                  <th className="text-center p-4 text-sm font-semibold text-orange-500">Turzz AI Chatbot</th>
                </tr>
              </thead>
              <tbody>
                {karsilastirma.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                    <td className="p-4 text-sm font-medium text-foreground">{row.konu}</td>
                    <td className="p-4 text-sm text-center text-muted-foreground">{row.manuel}</td>
                    <td className="p-4 text-sm text-center text-orange-600 dark:text-orange-400 font-medium">{row.chatbot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center mt-4">
            <Link to="/karsilastir/turzz-vs-manuel-whatsapp" className="text-sm text-orange-500 hover:underline">
              Detaylı karşılaştırmayı incele →
            </Link>
          </p>
        </div>
      </section>

      {/* İç linkler */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">İlgili Çözümler</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { href: "/ai-tur-rezervasyonu", baslik: "AI Tur Rezervasyonu", aciklama: "Otomatik rezervasyon süreci nasıl çalışır?" },
            { href: "/cok-dilli-musteri-hizmetleri", baslik: "Çok Dilli Hizmet", aciklama: "7 dilde yabancı turist hizmeti" },
            { href: "/tur-otomasyonu", baslik: "Tur Otomasyonu", aciklama: "Operasyonları otomatikleştir" },
          ].map((item) => (
            <Link key={item.href} to={item.href} className="block p-5 bg-card border border-border/50 rounded-lg hover:border-orange-300 transition-colors">
              <h3 className="font-semibold text-foreground mb-1">{item.baslik}</h3>
              <p className="text-sm text-muted-foreground">{item.aciklama} →</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-orange-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">WhatsApp Chatbot'unuzu Bugün Kurun</h2>
          <p className="text-orange-100 mb-8 max-w-xl mx-auto">
            14 günlük ücretsiz deneme ile başlayın. Kredi kartı gerekmez, kurulum 5 dakika.
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">Ücretsiz Denemeyi Başlat</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
