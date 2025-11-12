import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, MessageSquare, BarChart3, Users, Shield, Zap, CheckCircle2, ArrowRight, Check } from "lucide-react";

const Index = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "WhatsApp Entegrasyonu",
      description: "Müşterileriniz WhatsApp üzerinden 7/24 tur sorgulayabilir ve rezervasyon yapabilir."
    },
    {
      icon: Zap,
      title: "Yapay Zeka Destekli",
      description: "Akıllı asistan, müşteri sorularını anlayıp en uygun turları önerir."
    },
    {
      icon: BarChart3,
      title: "Detaylı Raporlama",
      description: "Tüm rezervasyonlarınızı ve WhatsApp konuşmalarınızı tek panelden yönetin."
    },
    {
      icon: Users,
      title: "Multi-Tenant Yapı",
      description: "Her acente kendi verileriyle çalışır, veri güvenliği %100 sağlanır."
    },
    {
      icon: Shield,
      title: "Güvenli Altyapı",
      description: "Lovable Cloud üzerinde, güvenli ve ölçeklenebilir altyapı."
    },
    {
      icon: CheckCircle2,
      title: "Kolay Kurulum",
      description: "Dakikalar içinde kurulum, hemen kullanıma hazır."
    }
  ];

  const benefits = [
    "Müşteri memnuniyeti artar - 7/24 hizmet",
    "Satışlarınızı artırın - Otomatik öneri sistemi",
    "Zamandan tasarruf - Otomatik rezervasyon yönetimi",
    "Her cihazdan erişim - Mobil uyumlu admin paneli"
  ];

  const pricingPlans = [
    {
      name: "Başlangıç",
      price: "1.999",
      period: "/ay",
      description: "Küçük acenteler için ideal",
      features: [
        "500 WhatsApp mesajı/ay",
        "1 kullanıcı hesabı",
        "Temel raporlama",
        "Email destek",
        "Tüm turlar sınırsız"
      ],
      highlighted: false
    },
    {
      name: "Profesyonel",
      price: "3.999",
      period: "/ay",
      description: "Büyüyen işletmeler için",
      features: [
        "2.000 WhatsApp mesajı/ay",
        "5 kullanıcı hesabı",
        "Gelişmiş raporlama",
        "Öncelikli destek",
        "Tüm turlar sınırsız",
        "Özel entegrasyon desteği"
      ],
      highlighted: true
    },
    {
      name: "Kurumsal",
      price: "Özel",
      period: "fiyat",
      description: "Büyük acenteler için",
      features: [
        "Sınırsız WhatsApp mesajı",
        "Sınırsız kullanıcı",
        "Özel raporlama",
        "7/24 destek",
        "Özel geliştirmeler",
        "API erişimi",
        "Dedicated account manager"
      ],
      highlighted: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-ocean flex items-center justify-center">
                <Plane className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">TurzzAI</h1>
                <p className="text-xs text-muted-foreground">Akıllı Tur Satış Sistemi</p>
              </div>
            </div>
            <Button asChild className="bg-gradient-ocean hover:opacity-90">
              <a href="/auth">Giriş Yap</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-hero opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-border mb-4">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">WhatsApp ile Otomatik Tur Satışı</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Tur Satışlarınızı <br />
              <span className="bg-gradient-ocean bg-clip-text text-transparent">Otomatikleştirin</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              WhatsApp üzerinden yapay zeka destekli asistan ile müşterileriniz 7/24 tur sorgulayabilir, 
              rezervasyon yapabilir. Tüm süreçleri tek panelden yönetin.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="bg-gradient-ocean hover:opacity-90 text-lg px-8" asChild>
                <a href="/auth">
                  Hemen Başla
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Demo İzle
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Güçlü Özellikler
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Modern teknoloji ile tur satış süreçlerinizi optimize edin
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-ocean flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h4 className="text-xl font-semibold text-foreground">{feature.title}</h4>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h3 className="text-3xl md:text-4xl font-bold text-foreground">
                  Neden TurzzAI?
                </h3>
                <p className="text-lg text-muted-foreground">
                  Acente işletmenizi bir sonraki seviyeye taşıyın. Müşteri memnuniyetini artırırken, 
                  operasyonel maliyetlerinizi düşürün.
                </p>
                <div className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <Card className="border-border/50 shadow-card p-8 bg-gradient-to-br from-card to-accent/20">
                <CardContent className="space-y-6 p-0">
                  <div className="space-y-2">
                    <div className="text-4xl font-bold text-foreground">%150</div>
                    <p className="text-muted-foreground">Satış artışı</p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-4xl font-bold text-foreground">7/24</div>
                    <p className="text-muted-foreground">Kesintisiz hizmet</p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-4xl font-bold text-foreground">10 dk</div>
                    <p className="text-muted-foreground">Kurulum süresi</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Size Uygun Planı Seçin
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              İşletmenizin ihtiyaçlarına göre esnek fiyatlandırma seçenekleri
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`border-border/50 shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlighted ? 'ring-2 ring-primary relative' : ''
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-ocean text-primary-foreground px-4 py-1">
                      En Popüler
                    </Badge>
                  </div>
                )}
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-2xl font-bold text-foreground">{plan.name}</h4>
                    <p className="text-muted-foreground text-sm">{plan.description}</p>
                  </div>
                  
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>

                  <Button 
                    className={`w-full ${
                      plan.highlighted 
                        ? 'bg-gradient-ocean hover:opacity-90' 
                        : 'bg-secondary hover:opacity-90'
                    }`}
                    asChild
                  >
                    <a href="/auth">
                      {plan.name === "Kurumsal" ? "İletişime Geç" : "Başlayın"}
                    </a>
                  </Button>

                  <div className="space-y-3 pt-4 border-t border-border">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground">
              Tüm planlarda 14 gün ücretsiz deneme. Kredi kartı bilgisi gerekmez.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-ocean opacity-5"></div>
        <div className="container mx-auto px-4 relative z-10">
          <Card className="max-w-4xl mx-auto border-border/50 shadow-card bg-gradient-to-br from-card to-accent/10">
            <CardContent className="p-12 text-center space-y-6">
              <h3 className="text-3xl md:text-4xl font-bold text-foreground">
                Hemen Başlamaya Hazır mısınız?
              </h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Demo hesap oluşturun ve tüm özellikleri ücretsiz deneyin. 
                Kredi kartı bilgisi gerekmez.
              </p>
              <Button size="lg" className="bg-gradient-ocean hover:opacity-90 text-lg px-8" asChild>
                <a href="/auth">
                  Ücretsiz Deneyin
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-ocean flex items-center justify-center">
                <Plane className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">TurzzAI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 TurzzAI. Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
