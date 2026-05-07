import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Bell, BarChart3, Users, Calendar, MessageSquare, CheckCircle2 } from "lucide-react";

const otomasyonlar = [
  { icon: Calendar, baslik: "Kontenjan Takibi", aciklama: "Her tur tarihi için ayrı kapasite yönetimi. Dolunca otomatik kapanır, alternatif sunar." },
  { icon: Bell, baslik: "Otomatik Hatırlatmalar", aciklama: "Tur 3 gün önce, 1 gün önce — müşteriye otomatik WhatsApp hatırlatıcısı." },
  { icon: MessageSquare, baslik: "Müşteri Takip Mesajları", aciklama: "Tur sonrası memnuniyet anketi ve tekrar rezervasyon teşviği otomatik gider." },
  { icon: Users, baslik: "Müşteri Segmentasyonu", aciklama: "VIP, düzenli, potansiyel, pasif müşteri otomatik etiketlenir. Özel kampanyalar yapılır." },
  { icon: BarChart3, baslik: "Satış Analitiği", aciklama: "Hangi tur, hangi dil, hangi gün en çok satar? Veritabanlı karar alın." },
  { icon: Zap, baslik: "Toplu Mesaj Kampanyaları", aciklama: "Belirli segment müşterilere toplu kampanya mesajı gönderin (Meta şablon onaylı)." },
];

export default function TurOtomasyonu() {
  return (
    <Layout>
      <SEOHead
        title="Tur Operatörü Otomasyon Yazılımı — Turzz AI"
        description="Tur operatörleri için kapsamlı otomasyon. Kontenjan takibi, otomatik hatırlatmalar, müşteri segmentasyonu, satış analitiği. Zamandan ve paradan tasarruf edin."
        keywords="tur operatörü otomasyon, tur yönetim yazılımı, kontenjan takip sistemi, tur hatırlatma sistemi, seyahat acentesi otomasyon"
        canonical="/tur-otomasyonu"
      />

      <section className="py-16 md:py-24 bg-gradient-to-b from-purple-50/50 to-background dark:from-purple-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-0">
            <Zap className="w-3 h-3 mr-1" /> Otomasyon
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Tur Operasyonlarınızı{" "}
            <span className="text-purple-500">Otomatikleştirin</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Kontenjan yönetiminden müşteri takibine, hatırlatmalardan analitiklere kadar
            tur operasyonunuzun %80'ini otomatik hale getirin.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-purple-500 hover:bg-purple-600 text-white">
              <Link to="/auth?mode=signup">Ücretsiz Dene</Link>
            </Button>
          </div>
          <div className="flex justify-center gap-8 mt-8">
            {[{ sayi: "40+", metin: "Saat/Ay Tasarruf" }, { sayi: "%80", metin: "Tekrarlayan İş Azaltma" }, { sayi: "0", metin: "Kaçırılan Hatırlatma" }].map((item) => (
              <div key={item.metin} className="text-center">
                <p className="text-2xl font-bold text-purple-500">{item.sayi}</p>
                <p className="text-xs text-muted-foreground">{item.metin}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
          Turzz AI Otomasyon Özellikleri
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {otomasyonlar.map((item, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-6">
                <item.icon className="w-8 h-8 text-purple-500 mb-3" />
                <h3 className="font-semibold text-foreground mb-2">{item.baslik}</h3>
                <p className="text-sm text-muted-foreground">{item.aciklama}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            Otomasyon Olmadan Ne Kadar Vakit Harcıyorsunuz?
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-card rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-muted text-left">
                  <th className="p-3 text-sm font-semibold">Görev</th>
                  <th className="p-3 text-sm font-semibold text-center">Manuel (dk/gün)</th>
                  <th className="p-3 text-sm font-semibold text-center text-purple-500">Turzz AI</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["WhatsApp yanıtlama", "120 dk", "0 dk (otomatik)"],
                  ["Kontenjan güncelleme", "30 dk", "0 dk (anlık)"],
                  ["Hatırlatma gönderi", "20 dk", "0 dk (otomatik)"],
                  ["Rapor hazırlama", "45 dk", "Anlık dashboard"],
                  ["Müşteri takibi", "30 dk", "Otomatik etiketleme"],
                ].map(([gorev, manuel, ai], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                    <td className="p-3 text-sm font-medium text-foreground">{gorev}</td>
                    <td className="p-3 text-sm text-center text-muted-foreground">{manuel}</td>
                    <td className="p-3 text-sm text-center text-purple-600 dark:text-purple-400 font-medium">{ai}</td>
                  </tr>
                ))}
                <tr className="bg-purple-50 dark:bg-purple-950 font-bold">
                  <td className="p-3 text-sm text-foreground">Toplam</td>
                  <td className="p-3 text-sm text-center text-muted-foreground">245 dk/gün</td>
                  <td className="p-3 text-sm text-center text-purple-600">~15 dk/gün</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-16 bg-purple-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Operasyonlarınızı Otomatikleştirin</h2>
          <p className="text-purple-100 mb-8">14 gün ücretsiz, kredi kartı gerekmez.</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">Hemen Başla</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
