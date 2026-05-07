import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Clock, MessageCircle, Star, CheckCircle2 } from "lucide-react";

export default function IncomingAcenteler() {
  return (
    <Layout>
      <SEOHead
        title="Incoming Tour Operatörleri için Yazılım — Turzz AI"
        description="Incoming tour operatörleri için 7 dilli WhatsApp chatbot. Yabancı turistlerle dil engeli olmadan 7/24 iletişim. Almanca, Rusça, Arapça otomatik yanıt."
        keywords="incoming tour operatörü yazılımı, yabancı turist chatbot, incoming acentesi, çok dilli tur yazılımı, inbound turizm yazılımı"
        canonical="/cozum/incoming-acenteler"
      />

      <section className="py-16 md:py-24 bg-gradient-to-b from-teal-50/50 to-background dark:from-teal-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-teal-100 text-teal-700 border-0">
            <Globe className="w-3 h-3 mr-1" /> Incoming Acenteler
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Yabancı Turistlerle{" "}
            <span className="text-teal-500">Dil Engeli Olmadan</span> İletişim
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Almanca, Rusça, Arapça veya Fransızca yazan turiste kendi dilinde anında yanıt verin.
            Turzz AI, incoming acentelerinin en büyük sorununu çözüyor.
          </p>
          <Button asChild size="lg" className="bg-teal-500 hover:bg-teal-600 text-white">
            <Link to="/auth?mode=signup">14 Gün Ücretsiz Dene</Link>
          </Button>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">
          Incoming Acenteler için Özel Avantajlar
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: Globe, baslik: "7 Dil, Sıfır Çeviri Maliyeti", aciklama: "Almanca, Rusça, Arapça, Fransızca, İspanyolca. Tercüman veya çeviri yazılımı gerekmez." },
            { icon: Clock, baslik: "Farklı Saat Dilimi Avantajı", aciklama: "Rusya 3 saat ileri, Körfez 1 saat geri. Çalışmadığınız saatlerde chatbot yanıtlıyor." },
            { icon: MessageCircle, baslik: "Kültürel Ton Uyumu", aciklama: "Arap turiste resmi, Alman turiste bilgi yoğun yanıt. Kültüre uygun iletişim." },
            { icon: Star, baslik: "Çoklu Tur Listeleme", aciklama: "Gelen turiste tüm tur seçenekleri otomatik listelenir, tarih ve fiyatlarla birlikte." },
          ].map((item, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-6">
                <item.icon className="w-8 h-8 text-teal-500 mb-3" />
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
            Incoming Acente için Tipik Senaryo
          </h2>
          <div className="space-y-4">
            {[
              { kim: "🇩🇪 Alman Turist, 22:30", mesaj: '"Haben Sie Ballonfahrten in Kappadokien für 2 Personen?"', yanit: "Turzz AI Almanca olarak Kapadokya balon turlarını, tarihleri ve fiyatları listeler" },
              { kim: "🇸🇦 Arap Turist, 02:15", mesaj: '"هل لديكم جولات في أنطاليا للعائلات؟"', yanit: "Turzz AI Arapça olarak aile turları seçeneklerini gösterir ve rezervasyona yönlendirir" },
              { kim: "🇷🇺 Rus Turist, 08:00", mesaj: '"Есть ли туры в Стамбул из Анталии?"', yanit: "Turzz AI Rusça olarak İstanbul turlarını listeler, tarih seçimine yönlendirir" },
            ].map((item, i) => (
              <div key={i} className="bg-card rounded-lg border border-border/50 p-4">
                <p className="text-sm font-medium text-foreground mb-2">{item.kim}</p>
                <p className="text-sm text-muted-foreground italic mb-2">{item.mesaj}</p>
                <div className="flex gap-2 items-start">
                  <span className="text-teal-500 text-xs font-medium mt-0.5">Turzz AI:</span>
                  <p className="text-xs text-muted-foreground">{item.yanit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-teal-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">Yabancı Pazarı Dil Engeli Olmadan Yakalayın</h2>
          <p className="text-teal-100 mb-8">14 gün ücretsiz, kredi kartı gerekmez.</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">Hemen Başla</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
