import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plane, MessageSquare, BarChart3, Users, Shield, Zap, CheckCircle2, ArrowRight, Check, Star, Quote, TrendingUp, ArrowUp, Bot, Sparkles, Brain, Clock, Bell, TrendingUpIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DemoChat } from "@/components/DemoChat";
import { supabase } from "@/integrations/supabase/client";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { SalesChatWidget } from "@/components/SalesChatWidget";

const Index = () => {
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const [isYearly, setIsYearly] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const contactFormSchema = z.object({
    name: z.string().trim().min(1, "İsim zorunludur").max(100, "İsim en fazla 100 karakter olabilir"),
    email: z.string().trim().email("Geçerli bir email adresi girin").max(255, "Email en fazla 255 karakter olabilir"),
    message: z.string().trim().min(10, "Mesaj en az 10 karakter olmalıdır").max(1000, "Mesaj en fazla 1000 karakter olabilir")
  });

  const scrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observers = sectionsRef.current.map((section, index) => {
      if (!section) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("animate-fade-in");
              entry.target.classList.remove("opacity-0", "translate-y-8");
            }
          });
        },
        { threshold: 0.1 }
      );

      observer.observe(section);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer?.disconnect());
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const features = [
    {
      icon: MessageSquare,
      title: "7/24 Otomatik Satış",
      description: "Gece yarısı bile müşteriler tur soruyor, rezervasyon yapıyor. Siz uyurken bile satış yapın - hiçbir fırsatı kaçırmayın.",
      metric: "Ortalama %120 rezervasyon artışı ilk ayda"
    },
    {
      icon: TrendingUp,
      title: "Gelir Takibi & Analiz",
      description: "Hangi turlar kazandırıyor? Hangi günler daha çok satış oluyor? Tüm gelir ve performans verilerinizi anlık görün.",
      metric: "Günlük, haftalık, aylık ciro raporları"
    },
    {
      icon: Zap,
      title: "WhatsApp'tan Direkt Ödeme",
      description: "Müşteri turunu buldu mu? Anında ödeme linkini gönderin, dakikalar içinde ödeme alsın. Ödeme takibi ve fatura otomatik.",
      metric: "Ödeme alma süresi: 2 dakika"
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: "Ayda 40+ Saat Tasarruf",
      description: "Tekrar eden soruları yanıtlamak, turları anlatmak, fiyat sormak... Artık bunların hepsi otomatik."
    },
    {
      icon: TrendingUpIcon,
      title: "İlk Ayda 2-3x Daha Fazla Satış",
      description: "Hiçbir müşteri kaçmıyor. Gece, gündüz, hafta sonu - her zaman aktif bir satış temsilciniz var."
    },
    {
      icon: Brain,
      title: "Her Müşteri Kişisel Takip",
      description: "Kim ne aradı? Bütçesi ne? Geçmişte ne aldı? AI her müşteriyi tanıyor, size özel öneriler yapıyor."
    },
    {
      icon: CheckCircle2,
      title: "Sadece 2 Tur = Kendini Ödüyor",
      description: "Başlangıç planı sadece 2.999₺/ay. Ayda sadece 2 ekstra tur satışı yapın, sistem kendini ödesin."
    }
  ];

  const calculatePrice = (basePrice: number, yearly: boolean) => {
    if (yearly && typeof basePrice === 'number' && !isNaN(basePrice)) {
      const yearlyPrice = basePrice * 12;
      const discountedPrice = yearlyPrice * 0.9; // %10 indirim
      return discountedPrice;
    }
    return basePrice;
  };

  const formatPrice = (priceStr: string, yearly: boolean) => {
    if (priceStr === "Özel") return "Özel";
    const price = parseFloat(priceStr.replace(".", ""));
    if (isNaN(price)) return priceStr;
    
    const finalPrice = calculatePrice(price, yearly);
    return finalPrice.toLocaleString('tr-TR');
  };

  const pricingPlans = [
    {
      name: "Başlangıç",
      price: "2.999",
      monthlyPrice: 2999,
      period: "/ay",
      description: "Küçük acenteler ve yeni başlayanlar için",
      features: [
        "💬 500 WhatsApp mesajı/ay (~16 mesaj/gün)",
        "📊 Temel raporlama ve istatistikler",
        "🗂️ Sınırsız tur ekleme",
        "📝 Rezervasyon yönetimi",
        "📧 Email destek (48 saat)",
        "🤖 AI destekli otomatik cevaplar",
        "💾 30 gün konuşma geçmişi"
      ],
      highlighted: false
    },
    {
      name: "Profesyonel",
      price: "7.999",
      monthlyPrice: 7999,
      period: "/ay",
      description: "Büyüyen işletmeler ve aktif acenteler için",
      features: [
        "💬 3.000 WhatsApp mesajı/ay (~100 mesaj/gün)",
        "📈 Gelişmiş raporlama ve analizler",
        "🗂️ Sınırsız tur ekleme",
        "📝 Gelişmiş rezervasyon yönetimi",
        "🎯 WhatsApp kullanıcı profilleri ve segmentasyon",
        "⚡ Öncelikli destek (24 saat içinde)",
        "🔗 CRM entegrasyon desteği",
        "💾 90 gün konuşma geçmişi",
        "🎨 Özel WhatsApp mesaj şablonları",
        "📱 Otomatik tur hatırlatıcıları"
      ],
      highlighted: true
    },
    {
      name: "Kurumsal",
      price: "14.999",
      monthlyPrice: 14999,
      period: "/ay",
      description: "Büyük acenteler ve zincir işletmeler için",
      features: [
        "💬 Sınırsız WhatsApp mesajı",
        "📊 Özel raporlama ve dashboardlar",
        "🗂️ Multi-branch (çoklu şube) desteği",
        "📝 Kurumsal rezervasyon yönetimi",
        "🎯 Gelişmiş müşteri segmentasyonu ve AI analizleri",
        "🚀 7/24 öncelikli destek",
        "🔌 API erişimi ve özel entegrasyonlar",
        "💾 Sınırsız konuşma geçmişi",
        "👔 Özel hesap yöneticisi (dedicated)",
        "⚙️ Özel geliştirme ve özelleştirmeler",
        "🔒 Kurumsal güvenlik ve SLA garantisi",
        "🌐 Çoklu WhatsApp hesabı desteği"
      ],
      highlighted: false
    }
  ];

  const testimonials = [
    {
      name: "Yasin Çetin",
      company: "Kampüs Travel",
      role: "İşletme Sahibi",
      content: "İlk ayda 18 yeni rezervasyon aldık. Daha önce gece mesaj atanlar 'yarın ararsınız' deyip başka acenteden alıyordu. Şimdi gece 2'de bile satış yapıyoruz!",
      rating: 5,
      result: "+18 rezervasyon ilk ayda"
    },
    {
      name: "Sıtkı Murat OĞRAK",
      company: "Aymila Turizm",
      role: "İşletme Müdürü",
      content: "Müşteriler 'çok hızlı cevap veriyorsunuz' diyor. Ayda 40+ saat zaman kazanıyorum. Artık gerçekten önemli işlere odaklanabiliyorum.",
      rating: 5,
      result: "Ayda 40+ saat tasarruf"
    },
    {
      name: "Mustafa Gülmez",
      company: "4 Eylül Turizm",
      role: "İşletme Sahibi",
      content: "Hangi turlar daha çok satıyor, hangi gün daha çok talep var - her şeyi görebiliyorum. Artık tahmine değil, veriye göre karar veriyorum. Gelir analizleri muhteşem!",
      rating: 5,
      result: "Veri odaklı karar"
    }
  ];

  const stats = [
    {
      icon: TrendingUp,
      value: "2-3x",
      label: "Ortalama Satış Artışı",
      color: "text-primary",
      subtext: "İlk ayda"
    },
    {
      icon: Clock,
      value: "40+",
      label: "Saat Tasarruf",
      color: "text-secondary",
      subtext: "Ayda"
    },
    {
      icon: MessageSquare,
      value: "7/24",
      label: "Kesintisiz Hizmet",
      color: "text-primary",
      subtext: "Hiç durmayan asistan"
    },
    {
      icon: CheckCircle2,
      value: "2 dk",
      label: "Ödeme Alma Süresi",
      color: "text-secondary",
      subtext: "WhatsApp'tan direkt"
    }
  ];

  const faqs = [
    {
      question: "Gerçekten ilk ayda satışlarım artacak mı?",
      answer: "Evet! Ortalama acentelerimiz ilk ayda %120-150 rezervasyon artışı görüyor. Çünkü artık gece yarısı, hafta sonu, her an müşterilerinize hizmet veriyorsunuz. Hiçbir fırsat kaçmıyor."
    },
    {
      question: "Kurulumu ben yapabilir miyim?",
      answer: "Kesinlikle! Kurulum 10-15 dakika sürüyor ve çok basit. Twilio hesabınızı bağlayın, turlarınızı ekleyin - hepsi bu. Takıldığınız yerde destek ekibimiz size yardımcı olur."
    },
    {
      question: "Twilio ve WhatsApp Business API ücreti var mı?",
      answer: "Evet, Twilio ücreti ayrıca faturalandırılır (genelde 100-200₺/ay). WhatsApp Business API kullanımı için gerekli. Kurulum sırasında size yol gösteriyoruz."
    },
    {
      question: "Müşterilerden direkt ödeme alabilir miyim?",
      answer: "Evet! SiPay entegrasyonu ile WhatsApp üzerinden anında ödeme linki gönderebilir, 2 dakika içinde ödeme alabilirsiniz. Ödeme takibi ve fatura otomatik."
    },
    {
      question: "Kaç tur ekleyebilirim?",
      answer: "Tüm planlarda sınırsız tur ekleyebilirsiniz. Fark sadece aylık WhatsApp mesaj limitinde. İhtiyacınıza göre planınızı istediğiniz zaman yükseltebilirsiniz."
    },
    {
      question: "İptal edersem ne olur?",
      answer: "İstediğiniz zaman iptal edebilirsiniz, sözleşme yok. İptal ettiğinizde mevcut dönem sonuna kadar hizmet almaya devam edersiniz. 14 gün ücretsiz deneme sırasında kredi kartı bile istemiyoruz."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={turzzLogo} alt="Turzz Logo" className="h-16 w-auto" />
              <div>
                <p className="text-sm text-muted-foreground">Akıllı Tur Satış Sistemi</p>
              </div>
            </div>
            <Button asChild className="bg-gradient-ocean hover:opacity-90">
              <a href="/auth">Giriş Yap</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={(el) => (sectionsRef.current[0] = el)} className="relative overflow-hidden py-20 md:py-32 opacity-0 translate-y-8 transition-all duration-700">
        <div className="absolute inset-0 bg-gradient-hero opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-border mb-4">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">WhatsApp ile Otomatik Tur Satışı</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              WhatsApp ile <br />
              <span className="bg-gradient-ocean bg-clip-text text-transparent">Tur Satışlarınızı Otomatikleştirin</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Yapay zeka destekli WhatsApp asistanı ile 7/24 tur satışı yapın. Müşteri sorularını yanıtlayın, 
              rezervasyon alın ve ödemeleri otomatik yönetin - siz uyurken bile satış yapın.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="bg-gradient-ocean hover:opacity-90 text-lg px-8" asChild>
                <a href="/auth">
                  14 Gün Ücretsiz Dene
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8" onClick={scrollToDemo}>
                Canlı Test Et
              </Button>
            </div>
          </div>
        </div>
      </section>


      {/* Stats Section */}
      <section ref={(el) => (sectionsRef.current[1] = el)} className="py-16 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {stats.map((stat, index) => (
              <Card key={index} className="border-border/50 shadow-card text-center">
                <CardContent className="p-6 space-y-2">
                  <stat.icon className={`w-8 h-8 ${stat.color} mx-auto`} />
                  <div className="text-3xl md:text-4xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {stat.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stat.subtext}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={(el) => (sectionsRef.current[2] = el)} className="py-20 bg-card/30 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              3 Ana Özellik - Hepsi Bu!
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Karmaşık değil, basit ve etkili. Size gerçekten değer katan özellikler.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-card to-card/50">
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-ocean flex items-center justify-center">
                    <feature.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h4 className="text-xl font-bold text-foreground">{feature.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-sm font-semibold text-primary">{feature.metric}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section ref={(el) => (sectionsRef.current[3] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Somut Sonuçlar, Gerçek Değer
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Sadece özellikler değil - işinize kattığı değer
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => (
              <Card key={index} className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-lg font-bold text-foreground">{benefit.title}</h4>
                      <p className="text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={(el) => (sectionsRef.current[4] = el)} className="py-20 bg-gradient-to-br from-secondary/5 to-primary/5 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Nasıl Çalışır?
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              WhatsApp'tan rezervasyona 3 basit adımda
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            <Card className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg">
                1
              </div>
              <CardContent className="p-6 pt-8 space-y-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-7 h-7 text-primary" />
                </div>
                <h4 className="text-xl font-semibold text-foreground text-center">Müşteri Mesaj Gönderir</h4>
                <p className="text-muted-foreground text-center">
                  WhatsApp üzerinden "Kapadokya turları" gibi doğal dilde arama yapar
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg">
                2
              </div>
              <CardContent className="p-6 pt-8 space-y-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                  <Brain className="w-7 h-7 text-primary" />
                </div>
                <h4 className="text-xl font-semibold text-foreground text-center">AI Analiz Yapar</h4>
                <p className="text-muted-foreground text-center">
                  Yapay zeka mesajı anlayıp en uygun turları önerir, fiyat ve tarih bilgisi verir
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg">
                3
              </div>
              <CardContent className="p-6 pt-8 space-y-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <h4 className="text-xl font-semibold text-foreground text-center">Rezervasyon Oluşur</h4>
                <p className="text-muted-foreground text-center">
                  Wizard rehberliğinde müşteri bilgileri alınır, rezervasyon tamamlanır
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16 text-center">
            <p className="text-lg text-muted-foreground mb-6">
              Tüm süreç otomatik ve 7/24 çalışır 🚀
            </p>
            <Button size="lg" className="bg-gradient-ocean hover:opacity-90" onClick={scrollToDemo}>
              Canlı Demo'yu İncele
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={(el) => (sectionsRef.current[5] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Gelişmiş Özellikler</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Rekabette Öne Çıkın
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Sektörün en gelişmiş AI ve otomasyon özellikleri
            </p>
          </div>

          <div className="max-w-6xl mx-auto space-y-12">
            {/* Intelligent User Profiles */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="border-border/50 shadow-card p-8 order-2 md:order-1">
                <CardContent className="p-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-ocean flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h4 className="text-2xl font-bold text-foreground">Akıllı Müşteri Profilleri</h4>
                  <p className="text-muted-foreground">
                    Her müşterinin tercihlerini, arama geçmişini ve bütçesini otomatik olarak takip edin. 
                    AI kişiselleştirilmiş önerilerde bulunur.
                  </p>
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">Otomatik tercih öğrenme</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">Bütçe bazlı segmentasyon</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">Arama geçmişi analizi</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="order-1 md:order-2 flex justify-center">
                <div className="w-full max-w-sm aspect-square bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-32 h-32 text-primary/40" />
                </div>
              </div>
            </div>

            {/* Conversation Analytics */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="flex justify-center">
                <div className="w-full max-w-sm aspect-square bg-gradient-to-br from-secondary/20 to-primary/20 rounded-2xl flex items-center justify-center">
                  <BarChart3 className="w-32 h-32 text-secondary/40" />
                </div>
              </div>
              <Card className="border-border/50 shadow-card p-8">
                <CardContent className="p-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-ocean flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h4 className="text-2xl font-bold text-foreground">Konuşma Analizleri</h4>
                  <p className="text-muted-foreground">
                    AI destekli sentiment analizi ve otomatik konuşma özetleri ile müşteri memnuniyetini ölçün, 
                    trendleri yakalayın.
                  </p>
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-secondary"></div>
                      <span className="text-sm text-foreground">Sentiment analizi (Pozitif/Negatif)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-secondary"></div>
                      <span className="text-sm text-foreground">Otomatik konuşma özetleri</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-secondary"></div>
                      <span className="text-sm text-foreground">Konu ve trend takibi</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Auto Reminders */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="border-border/50 shadow-card p-8 order-2 md:order-1">
                <CardContent className="p-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-ocean flex items-center justify-center">
                    <Bell className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h4 className="text-2xl font-bold text-foreground">Otomatik Tur Hatırlatıcıları</h4>
                  <p className="text-muted-foreground">
                    Turdan 3 gün önce otomatik WhatsApp hatırlatmaları gönderilir. 
                    Müşteri memnuniyetini artırın, iptal oranlarını düşürün.
                  </p>
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">Özelleştirilebilir mesaj şablonları</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">Otomatik gönderim (3 gün öncesi)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">Tur detayları ve bilgilendirme</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="order-1 md:order-2 flex justify-center">
                <div className="w-full max-w-sm aspect-square bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center">
                  <Bell className="w-32 h-32 text-primary/40" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={(el) => (sectionsRef.current[6] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Gerçek Sonuçlar, Gerçek Acenteler
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              İşlerini büyüten acenteler ne diyor?
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-border/50 shadow-card hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-card/50">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Quote className="w-10 h-10 text-primary/20" />
                    <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/20">
                      {testimonial.result}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-secondary text-secondary" />
                    ))}
                  </div>

                  <p className="text-foreground leading-relaxed">
                    "{testimonial.content}"
                  </p>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-ocean flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary-foreground">
                          {testimonial.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{testimonial.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {testimonial.role}, {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>250+ mutlu acente</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section ref={(el) => {
        sectionsRef.current[7] = el;
        if (el) demoRef.current = el as HTMLDivElement;
      }} className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-border mb-4">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">Canlı Demo</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Hemen Test Edin
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Yapay zeka destekli asistanımızı şimdi deneyin. Tur sorguları yapın, rezervasyon simülasyonu yapın.
            </p>
          </div>

          <DemoChat />

          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground mb-4">
              Bu bir demo chatbot'tur. Gerçek sisteminizde kendi turlarınızı ve ayarlarınızı kullanabilirsiniz.
            </p>
            <Button size="lg" className="bg-gradient-ocean hover:opacity-90" asChild>
              <a href="/auth">
                Hemen Başlayın
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={(el) => (sectionsRef.current[8] = el)} className="py-20 bg-card/30 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Size Uygun Planı Seçin
            </h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
              İşletmenizin ihtiyaçlarına göre esnek fiyatlandırma seçenekleri
            </p>
            
            {/* 14 Days Free Trial Banner */}
            <div className="mb-6">
              <a 
                href="/auth"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-ocean text-primary-foreground mb-4 animate-pulse hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-lg font-bold">14 GÜN ÜCRETSİZ DENEME</span>
                <Sparkles className="w-5 h-5" />
              </a>
              <p className="text-sm text-muted-foreground">
                Kredi kartı bilgisi gerektirmez • İstediğiniz zaman iptal edebilirsiniz
              </p>
            </div>

            {/* Billing Period Toggle */}
            <div className="flex items-center justify-center gap-3 p-4 bg-card rounded-lg w-fit mx-auto border border-border">
              <Label htmlFor="landing-billing-toggle" className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
                Aylık
              </Label>
              <Switch
                id="landing-billing-toggle"
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <Label htmlFor="landing-billing-toggle" className={isYearly ? "font-semibold" : "text-muted-foreground"}>
                Yıllık
              </Label>
              {isYearly && (
                <span className="ml-2 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                  %10 İndirim
                </span>
              )}
            </div>
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
                  
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        {formatPrice(plan.price, isYearly)}
                      </span>
                      <span className="text-muted-foreground">
                        {plan.price === "Özel" ? plan.period : isYearly ? "₺/yıl" : "₺/ay"}
                      </span>
                    </div>
                    {isYearly && plan.monthlyPrice > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground line-through">
                          {(plan.monthlyPrice * 12).toLocaleString('tr-TR')}₺/yıl
                        </p>
                        <p className="text-sm text-green-600 font-medium">
                          {(plan.monthlyPrice * 12 * 0.1).toLocaleString('tr-TR')}₺ tasarruf
                        </p>
                      </div>
                    )}
                  </div>

                  <Button 
                    className={`w-full ${
                      plan.highlighted 
                        ? 'bg-gradient-ocean hover:opacity-90' 
                        : 'bg-secondary hover:opacity-90'
                    }`}
                    asChild
                  >
                    <a href={`/auth?mode=signup&plan=${plan.name.toLowerCase().replace('ı', 'i')}&billing=${isYearly ? 'yearly' : 'monthly'}`}>
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

      {/* FAQ Section */}
      <section ref={(el) => (sectionsRef.current[9] = el)} className="py-20 opacity-0 translate-y-8 transition-all duration-700">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Sık Sorulan Sorular
              </h3>
              <p className="text-muted-foreground text-lg">
                Merak ettiklerinizin yanıtlarını burada bulabilirsiniz
              </p>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border border-border/50 rounded-lg px-6 bg-card shadow-sm"
                >
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="text-center mt-8">
              <p className="text-muted-foreground mb-4">
                Başka sorularınız mı var?
              </p>
            </div>

            {/* Contact Form */}
            <Card className="mt-8 border-border/50 shadow-card max-w-2xl mx-auto">
              <CardContent className="p-8">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSubmittingForm(true);

                  try {
                    const formData = new FormData(e.currentTarget);
                    const data = {
                      name: formData.get('name') as string,
                      email: formData.get('email') as string,
                      message: formData.get('message') as string
                    };

                    // Validate form data
                    const validatedData = contactFormSchema.parse(data);

                    // Save to Supabase
                    const { error } = await supabase
                      .from('contact_forms')
                      .insert({
                        name: validatedData.name,
                        email: validatedData.email,
                        message: validatedData.message,
                        status: 'new'
                      });

                    if (error) throw error;

                    toast({
                      title: "Mesajınız Gönderildi! ✅",
                      description: "En kısa sürede size geri dönüş yapacağız.",
                    });

                    // Reset form
                    (e.target as HTMLFormElement).reset();
                  } catch (error) {
                    if (error instanceof z.ZodError) {
                      toast({
                        title: "Form Hatası",
                        description: error.errors[0].message,
                        variant: "destructive"
                      });
                    } else {
                      console.error('Contact form error:', error);
                      toast({
                        title: "Hata",
                        description: "Mesaj gönderilemedi. Lütfen tekrar deneyin.",
                        variant: "destructive"
                      });
                    }
                  } finally {
                    setIsSubmittingForm(false);
                  }
                }} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground">İsim Soyisim</Label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      maxLength={100}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="İsminiz"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">E-posta</Label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      maxLength={255}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="email@ornek.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-foreground">Mesajınız</Label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      maxLength={1000}
                      rows={4}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="Mesajınızı buraya yazın..."
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-ocean hover:opacity-90"
                    disabled={isSubmittingForm}
                  >
                    {isSubmittingForm ? "Gönderiliyor..." : "Mesaj Gönder"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={(el) => (sectionsRef.current[10] = el)} className="py-20 relative overflow-hidden opacity-0 translate-y-8 transition-all duration-700">
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

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 w-12 h-12 rounded-full bg-gradient-ocean hover:opacity-90 shadow-lg animate-fade-in"
          size="icon"
        >
          <ArrowUp className="w-5 h-5" />
        </Button>
      )}

      {/* Sales Chat Widget */}
      <SalesChatWidget />
    </div>
  );
};

export default Index;
