import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, TrendingUp, Users, CheckCircle2 } from "lucide-react";

const diller = [
  { bayrak: "🇹🇷", kod: "TR", dil: "Türkçe", aciklama: "Yerli müşteriler için ana dil desteği" },
  { bayrak: "🇬🇧", kod: "EN", dil: "İngilizce", aciklama: "Uluslararası turistler için standart dil" },
  { bayrak: "🇩🇪", kod: "DE", dil: "Almanca", aciklama: "Almanya Türk diasporası ve Alman turistler" },
  { bayrak: "🇷🇺", kod: "RU", dil: "Rusça", aciklama: "Rusya ve BDT ülkelerinden gelen turistler" },
  { bayrak: "🇸🇦", kod: "AR", dil: "Arapça", aciklama: "Körfez ve Orta Doğu pazarı" },
  { bayrak: "🇫🇷", kod: "FR", dil: "Fransızca", aciklama: "Fransa ve Frankofonlar" },
  { bayrak: "🇪🇸", kod: "ES", dil: "İspanyolca", aciklama: "İspanya ve Latin Amerika" },
];

export default function CokDilliHizmet() {
  return (
    <Layout>
      <SEOHead
        title="Çok Dilli Müşteri Hizmetleri — 7 Dilde Tur Satışı"
        description="7 dilde otomatik WhatsApp müşteri hizmetleri. Türkçe, İngilizce, Almanca, Rusça, Arapça, Fransızca, İspanyolca. Yabancı turistlerle dil engeli olmadan iletişim."
        keywords="çok dilli müşteri hizmetleri tur, yabancı turist hizmeti, otomatik tercüme chatbot, incoming acentesi yazılımı, çok dilli turizm"
        canonical="/cok-dilli-musteri-hizmetleri"
      />

      <section className="py-16 md:py-24 bg-gradient-to-b from-green-50/50 to-background dark:from-green-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0">
            <Globe className="w-3 h-3 mr-1" /> Çok Dilli Hizmet
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            <span className="text-green-500">7 Dilde</span> Otomatik Müşteri Hizmetleri
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Yabancı turistlerle dil bariyeri olmadan iletişim kurun. Turzz AI, müşterinin
            yazdığı dili otomatik algılar ve aynı dilde yanıt verir.
          </p>
          <Button asChild size="lg" className="bg-green-500 hover:bg-green-600 text-white">
            <Link to="/auth?mode=signup">Ücretsiz Dene</Link>
          </Button>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          Desteklenen 7 Dil
        </h2>
        <p className="text-center text-muted-foreground mb-10">
          Müşteri hangi dilde yazarsa Turzz AI otomatik olarak aynı dilde yanıtlar.
          Manuel dil seçimi veya çevirmen gerekmiyor.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {diller.map((item) => (
            <Card key={item.kod} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-3xl">{item.bayrak}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{item.dil}</span>
                    <Badge variant="outline" className="text-xs">{item.kod}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.aciklama}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            Yabancı Turist Pazarı Neden Önemli?
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {[
              { icon: TrendingUp, rakam: "45M+", metin: "Türkiye'ye gelen yabancı turist (yıllık)" },
              { icon: Users, rakam: "%62", metin: "Yabancı turistlerin tur hizmetleri için WhatsApp kullandığı oran" },
              { icon: Globe, rakam: "3x", metin: "Çok dilli destek sunan acentelerin daha fazla yabancı rezervasyon aldığı oran" },
            ].map((item, i) => (
              <Card key={i} className="text-center p-6">
                <CardContent className="pt-0">
                  <item.icon className="w-8 h-8 text-green-500 mx-auto mb-3" />
                  <p className="text-3xl font-bold text-foreground mb-1">{item.rakam}</p>
                  <p className="text-sm text-muted-foreground">{item.metin}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4 max-w-3xl">
        <h2 className="text-2xl font-bold text-center text-foreground mb-8">
          Çok Dilli Hizmetin Faydaları
        </h2>
        <ul className="space-y-4">
          {[
            "Alman, Rus veya Arap turiste kendi dilinde anında yanıt verin",
            "Çevirmen maliyetinden kurtulun",
            "Rezervasyon sürecinin tamamı hedef dilde ilerler",
            "Kültürel tonlamaya uygun yanıtlar (resmi/samimi)",
            "İncoming acenteleri için özellikle kritik avantaj",
            "Her dil için ayrı FAQ ve mesaj şablonları",
          ].map((item, i) => (
            <li key={i} className="flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 p-5 bg-green-50 dark:bg-green-950 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>İpucu:</strong> Başlangıç paketi 1 dil, Profesyonel paket 3 dil, Kurumsal paket
            tüm 7 dili destekler.{" "}
            <Link to="/#pricing" className="text-green-600 hover:underline">Paketleri karşılaştır →</Link>
          </p>
        </div>
      </section>

      <section className="py-16 bg-green-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Yabancı Turistlere Kendi Dillerinde Hizmet Verin</h2>
          <p className="text-green-100 mb-8">14 gün ücretsiz deneyin, kredi kartı gerekmez.</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">Ücretsiz Başla</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
