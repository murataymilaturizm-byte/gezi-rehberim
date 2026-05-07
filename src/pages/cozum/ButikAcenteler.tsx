import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, DollarSign, Clock, Smile, CheckCircle2 } from "lucide-react";

export default function ButikAcenteler() {
  return (
    <Layout>
      <SEOHead
        title="Küçük ve Butik Seyahat Acentesi Yazılımı — Turzz AI"
        description="Küçük ve butik seyahat acenteleri için uygun fiyatlı WhatsApp chatbot. Büyük kurumların teknolojisine erişin, düşük maliyetle profesyonel görünüm kazanın."
        keywords="küçük seyahat acentesi yazılımı, butik acente teknoloji, uygun fiyatlı tur yazılımı, küçük işletme chatbot, seyahat acentesi otomasyon"
        canonical="/cozum/butik-acenteler"
      />

      <section className="py-16 md:py-24 bg-gradient-to-b from-pink-50/50 to-background dark:from-pink-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-pink-100 text-pink-700 border-0">
            <Star className="w-3 h-3 mr-1" /> Butik Acenteler
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Büyük Şirketlerin Teknolojisi,{" "}
            <span className="text-pink-500">Küçük Acentenin Bütçesi</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            1-3 kişilik butik acenteniz büyük şirketler gibi 7/24 profesyonel hizmet verebilir.
            Turzz AI, küçük işletmeler için özel tasarlanmış başlangıç paketi ile başlangıç.
          </p>
          <Button asChild size="lg" className="bg-pink-500 hover:bg-pink-600 text-white">
            <Link to="/auth?mode=signup">2.999₺'dan Başla</Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-2">14 gün ücretsiz deneme dahil</p>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl font-bold text-center text-foreground mb-4">
          Neden Küçük Acenteler Turzz AI'ı Tercih Ediyor?
        </h2>
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          {[
            { icon: DollarSign, baslik: "Çalışan Maaşı Değil, Yazılım Aboneliği", aciklama: "Bir çalışanın aylık maliyeti 15.000-20.000₺. Turzz AI Başlangıç paketi 2.999₺/ay." },
            { icon: Clock, baslik: "Kurulum 5-10 Dakika", aciklama: "Teknik bilgi gerekmez. Turlarınızı sisteme girin, WhatsApp'ı bağlayın, hazır." },
            { icon: Smile, baslik: "Profesyonel Görünüm", aciklama: "Müşteri size yazıyor, sanki büyük bir call center varmış gibi anında yanıt alıyor." },
            { icon: Star, baslik: "Büyüdükçe Skalablıyor", aciklama: "Başlangıç paketinden Profesyonel veya Kurumsal'a tek tıkla geçiş." },
          ].map((item, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-6">
                <item.icon className="w-8 h-8 text-pink-500 mb-3" />
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
            Başlangıç Paketi Ne İçeriyor?
          </h2>
          <Card className="border-pink-200 dark:border-pink-900">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Başlangıç Paketi</h3>
                  <p className="text-muted-foreground text-sm">Küçük acenteler için ideal başlangıç</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-pink-500">2.999₺</p>
                  <p className="text-xs text-muted-foreground">/ay</p>
                </div>
              </div>
              <ul className="space-y-2">
                {[
                  "1.000 WhatsApp mesajı/ay",
                  "En fazla 10 tur",
                  "1 dil desteği",
                  "Otomatik rezervasyon sihirbazı",
                  "Temel analitik raporları",
                  "E-posta destek",
                  "14 gün ücretsiz deneme",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2 items-center text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-pink-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full mt-6 bg-pink-500 hover:bg-pink-600 text-white">
                <Link to="/auth?mode=signup">Denemeyi Başlat</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 bg-pink-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">Butik Acentenizi Dijitalleştirin</h2>
          <p className="text-pink-100 mb-8">14 gün ücretsiz, kredi kartı gerekmez.</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">Ücretsiz Başla</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
