import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, CalendarCheck, MessageSquare, Shield, BarChart3, RefreshCw } from "lucide-react";

export default function AITurRezervasyonu() {
  return (
    <Layout>
      <SEOHead
        title="AI Tur Rezervasyon Sistemi — Otomatik Rezervasyon Asistanı"
        description="AI tabanlı tur rezervasyon sistemi ile 7/24 otomatik rezervasyon alın. NLU teknolojisi, 7 dil desteği, anlık kontenjan takibi. Turzz AI ile tanışın."
        keywords="ai tur rezervasyon sistemi, otomatik rezervasyon, yapay zeka turizm, online tur rezervasyonu, tur rezervasyon yazılımı"
        canonical="/ai-tur-rezervasyonu"
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-blue-50/50 to-background dark:from-blue-950/20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0">
            <Brain className="w-3 h-3 mr-1" /> Yapay Zeka
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            AI Tur Rezervasyon Sistemi ile{" "}
            <span className="text-blue-500">7/24 Otomatik Satış</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Turzz AI'ın yapay zeka motoru, müşteri mesajlarını anlayarak otomatik rezervasyon
            oluşturur. Çalışanlarınız uyurken bile tur satışı devam eder.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-blue-500 hover:bg-blue-600 text-white">
              <Link to="/auth?mode=signup">Ücretsiz Başla</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/whatsapp-chatbot-seyahat-acentesi">WhatsApp Chatbot'u İncele</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Klasik vs AI */}
      <section className="py-16 container mx-auto px-4 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          Klasik Rezervasyon vs AI Rezervasyon Sistemi
        </h2>
        <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
          Geleneksel yöntemler ile yapay zeka destekli sistem arasındaki fark çok büyük.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-red-200 dark:border-red-900">
            <CardContent className="p-6">
              <h3 className="font-bold text-foreground mb-4">❌ Klasik Yöntem</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Müşteri WhatsApp'tan yazıyor, çalışan telefona bakana kadar bekliyor",
                  "Çalışan manuel fiyat listesi açıp bilgi gönderiyor",
                  "Müşteri tarih soruyor, çalışan Excel'e bakıyor",
                  "Rezervasyon formu e-posta ile gidip geliyor",
                  "Ödeme takibi ayrı spreadsheet'te tutuluyor",
                  "Gece ve hafta sonu satış yok",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-900">
            <CardContent className="p-6">
              <h3 className="font-bold text-foreground mb-4">✅ Turzz AI ile</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Müşteri yazıyor, AI saniyeler içinde doğru dilde yanıtlıyor",
                  "Sistem tur listesini, fiyatları ve tarihleri otomatik sunuyor",
                  "Müsait tarihler anlık olarak görünüyor, kontenjan takibi otomatik",
                  "Rezervasyon bilgileri chatbot tarafından adım adım toplanıyor",
                  "Ödeme linki otomatik gönderiliyor",
                  "Gece 2'de, hafta sonu, tatilde — 7/24 satış",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* NLU Teknolojisi */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            NLU Teknolojisi Nedir? Basit Anlatımla
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
            NLU (Natural Language Understanding — Doğal Dil Anlama) teknolojisi,
            insanların yazdığı cümleleri bilgisayarın anlamasını sağlar.
          </p>
          <div className="bg-card border border-border rounded-xl p-6 mb-8">
            <p className="text-sm text-muted-foreground mb-4 font-medium">Örnek: Müşteri şunu yazıyor:</p>
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 mb-4 text-sm">
              💬 <em>"Haziranda Kapadokya balonlu tur var mı, 2 kişi için bakıyorum"</em>
            </div>
            <p className="text-sm text-muted-foreground mb-3">AI şunları anlıyor:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { etiket: "Tur", deger: "Kapadokya Balonlu" },
                { etiket: "Ay", deger: "Haziran" },
                { etiket: "Kişi", deger: "2 Yetişkin" },
                { etiket: "Niyet", deger: "Bilgi Alma" },
              ].map((item) => (
                <div key={item.etiket} className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{item.etiket}</p>
                  <p className="text-sm font-semibold text-foreground">{item.deger}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-center text-muted-foreground text-sm">
            Bu sayede sistem müşteriyi anlar ve doğrudan Haziran tarihli Kapadokya turlarını listeler.
            Ne tekrar sormaya, ne de manuel aramaya gerek yok.
          </p>
        </div>
      </section>

      {/* 7 Dilde Rezervasyon */}
      <section className="py-16 container mx-auto px-4 max-w-4xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
          7 Dilde Otomatik Rezervasyon
        </h2>
        <p className="text-center text-muted-foreground mb-10">
          Yabancı turistlerle dil engeli olmadan rezervasyon sürecini tamamlayın.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { dil: "Türkçe", bayrak: "🇹🇷", pazar: "Yerli Pazar" },
            { dil: "İngilizce", bayrak: "🇬🇧", pazar: "Uluslararası" },
            { dil: "Almanca", bayrak: "🇩🇪", pazar: "Avrupa" },
            { dil: "Rusça", bayrak: "🇷🇺", pazar: "Rusya/BDT" },
            { dil: "Arapça", bayrak: "🇸🇦", pazar: "Orta Doğu" },
            { dil: "Fransızca", bayrak: "🇫🇷", pazar: "Fransa" },
            { dil: "İspanyolca", bayrak: "🇪🇸", pazar: "İspanya/LatAm" },
            { dil: "Yakında", bayrak: "🌍", pazar: "Daha Fazla" },
          ].map((item) => (
            <Card key={item.dil} className="text-center p-4 border-border/50">
              <CardContent className="pt-0">
                <p className="text-2xl mb-1">{item.bayrak}</p>
                <p className="font-semibold text-foreground text-sm">{item.dil}</p>
                <p className="text-xs text-muted-foreground">{item.pazar}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center mt-6">
          <Link to="/cok-dilli-musteri-hizmetleri" className="text-blue-500 hover:underline text-sm">
            Çok dilli hizmet hakkında detaylı bilgi →
          </Link>
        </p>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-500 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">AI Rezervasyon Sisteminizi Kurun</h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            14 günlük ücretsiz deneme ile AI tur rezervasyon sistemini test edin.
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth?mode=signup">Ücretsiz Denemeyi Başlat</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
