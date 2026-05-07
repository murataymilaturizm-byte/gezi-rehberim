import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, TrendingUp, CalendarCheck } from "lucide-react";

export default function GunubirlikTur() {
  return (
    <Layout>
      <SEOHead
        title="Günübirlik Tur Rezervasyon Sistemi — Hızlı ve Otomatik"
        description="Günübirlik tur operatörleri için WhatsApp chatbot. Hızlı rezervasyon, son dakika satışları, anlık kontenjan takibi. 7/24 otomatik tur satışı."
        keywords="günübirlik tur rezervasyon, day trip rezervasyon sistemi, günlük tur satışı, tur chatbot, anlık rezervasyon"
        canonical="/cozum/gunubirlik-tur"
      />

      <section className="py-16 md:py-24 bg-gradient-to-b from-yellow-50/50 to-background dark:from-yellow-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-yellow-100 text-yellow-700 border-0">
            <Zap className="w-3 h-3 mr-1" /> Günübirlik Tur
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Günübirlik Turlar için{" "}
            <span className="text-yellow-500">Hızlı Rezervasyon</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            "Yarın için yer var mı?" sorusuna saniyeler içinde yanıt. Kontenjan dolmadan son dakika
            satışlarını kaçırmayın. Turzz AI ile günübirlik turlarınızı maksimize edin.
          </p>
          <Button asChild size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-white">
            <Link to="/auth?mode=signup">Ücretsiz Başla</Link>
          </Button>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">
          Günübirlik Tur Operatörlerine Özel Özellikler
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: Zap, baslik: "Anlık Rezervasyon", aciklama: "Müşteri yer soruyor, chatbot anında \"Evet, 3 yer kaldı, rezervasyon yapalım mı?\" yanıtı veriyor." },
            { icon: Clock, baslik: "Son Dakika Satışları", aciklama: "Sabah 07:00'da \"bugün için yer var mı?\" sorusuna otomatik yanıt. Boş yer satılıyor, gelir artıyor." },
            { icon: CalendarCheck, baslik: "Günlük Kontenjan Yönetimi", aciklama: "Her gün için ayrı kapasite ayarı. Kapasite dolduğunda otomatik kapatma, alternatifleri önerme." },
            { icon: TrendingUp, baslik: "Hangi Günler Dolu, Hangileri Boş?", aciklama: "Analytics dashboardundan hangi güne, hangi dil müşterisinin daha çok talep ettiğini görün." },
          ].map((item, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-6">
                <item.icon className="w-8 h-8 text-yellow-500 mb-3" />
                <h3 className="font-semibold text-foreground mb-2">{item.baslik}</h3>
                <p className="text-sm text-muted-foreground">{item.aciklama}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">Tipik Senaryo</h2>
          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Saat 22:45 — Turist otelde telefona bakıyor:
            </p>
            <div className="space-y-3">
              {[
                { gonder: "user", mesaj: "Yarın Kapadokya tur var mı? 2 kişilik" },
                { gonder: "bot", mesaj: "Merhaba! Yarın 8 Mayıs için Kapadokya Balon Turu'nda 4 yer kaldı. Kalkış 05:30, fiyat 2 kişi için 3.000₺. Rezervasyon yapalım mı?" },
                { gonder: "user", mesaj: "Evet yapayım" },
                { gonder: "bot", mesaj: "Harika! Adınızı ve telefon numaranızı alabilir miyim?" },
              ].map((item, i) => (
                <div key={i} className={`flex ${item.gonder === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${item.gonder === "user" ? "bg-yellow-500 text-white" : "bg-muted text-foreground"}`}>
                    {item.mesaj}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Siz uyurken rezervasyon tamamlandı ✅
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-yellow-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">Son Dakika Satışlarını Kaçırmayın</h2>
          <p className="text-yellow-100 mb-8">14 gün ücretsiz, kredi kartı gerekmez.</p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">Hemen Dene</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
