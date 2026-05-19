import { useState, useEffect } from "react";
import { Joyride, STATUS, EVENTS } from "react-joyride";
import type { CallBackProps, Step } from "react-joyride";
import { useIsMobile } from "@/hooks/use-mobile";

interface OnboardingTourProps {
  agencyId: string;
  shouldRun: boolean;
  onComplete: () => void;
}

function getCurrentTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const STORAGE_KEY = (id: string) => `turzz_tour_done_${id}`;

// ─── Rich step content helper ────────────────────────────────────────────────
interface StepContentProps {
  description: string;
  bullets?: string[];
  tip?: string;
  isDark: boolean;
}

function StepContent({ description, bullets = [], tip, isDark }: StepContentProps) {
  const muted = isDark ? "#94a3b8" : "#64748b";
  const tipBg = isDark ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)";
  const tipBorder = "rgba(249,115,22,0.35)";

  return (
    <div style={{ fontSize: 14, lineHeight: 1.65 }}>
      <p style={{ margin: "0 0 10px", color: isDark ? "#e2e8f0" : "#1e293b" }}>
        {description}
      </p>
      {bullets.length > 0 && (
        <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ marginBottom: 5, color: muted }}>{b}</li>
          ))}
        </ul>
      )}
      {tip && (
        <div
          style={{
            background: tipBg,
            border: `1px solid ${tipBorder}`,
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12.5,
            color: isDark ? "#fdba74" : "#c2410c",
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
          <span>{tip}</span>
        </div>
      )}
    </div>
  );
}

// ─── Welcome / Complete screens ──────────────────────────────────────────────
function WelcomeContent({ isDark }: { isDark: boolean }) {
  const cards = [
    { icon: "🗺️", text: "Tur yönetimi" },
    { icon: "💬", text: "WhatsApp entegrasyonu" },
    { icon: "📊", text: "Gelir analizleri" },
    { icon: "⚡", text: "Toplu araçlar" },
  ];
  // Solid renkler — isDark hangi değer olursa olsun görünür
  const cardBg = isDark ? "#1e293b" : "#f1f5f9";
  const cardText = isDark ? "#f8fafc" : "#1e293b";
  const descColor = isDark ? "#94a3b8" : "#64748b";

  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: 14, color: descColor, marginBottom: 16, lineHeight: 1.6 }}>
        Bu kısa turda panelin tüm bölümlerini tanıyacaksınız.
        <br />İstediğiniz zaman <strong style={{ color: cardText }}>Atla</strong> veya{" "}
        <strong style={{ color: cardText }}>Esc</strong> ile çıkabilirsiniz.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
        {cards.map((c) => (
          <div
            key={c.text}
            style={{
              background: cardBg,
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
              color: cardText,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
            {c.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompleteContent({ isDark }: { isDark: boolean }) {
  const items = [
    { icon: "⌘K", label: "Hızlı erişim için Ctrl+K" },
    { icon: "🔔", label: "Yeni rezervasyonlarda bildirim" },
    { icon: "🔄", label: "Ctrl+K → Turu tekrar başlat" },
  ];
  const bg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  return (
    <div>
      <p style={{ fontSize: 14, color: isDark ? "#94a3b8" : "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
        Artık paneli kullanmaya hazırsınız! İşte aklınızda tutmanız gerekenler:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: bg, borderRadius: 8, padding: "8px 12px",
              fontSize: 13, color: isDark ? "#e2e8f0" : "#374151",
            }}
          >
            <code
              style={{
                background: isDark ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.12)",
                color: isDark ? "#fb923c" : "#ea580c",
                borderRadius: 5, padding: "2px 7px", fontSize: 12, fontFamily: "monospace",
              }}
            >
              {it.icon}
            </code>
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function OnboardingTour({ agencyId, shouldRun, onComplete }: OnboardingTourProps) {
  const isMobile = useIsMobile();
  const [runTour, setRunTour] = useState(false);
  const isDark = getCurrentTheme() === "dark";

  const bg = isDark ? "#0f172a" : "#ffffff";
  const fg = isDark ? "#f1f5f9" : "#1e293b";

  // Helper to build a step with rich content
  const step = (
    target: string,
    placement: Step["placement"],
    title: string,
    description: string,
    bullets: string[] = [],
    tip?: string,
  ): Step => ({
    target,
    placement,
    title,
    content: <StepContent description={description} bullets={bullets} tip={tip} isDark={isDark} />,
    disableBeacon: true,
  });

  const desktopSteps: Step[] = [
    // 1. Welcome
    {
      target: "body",
      placement: "center",
      title: "🎉 Turzz AI'a Hoş Geldiniz!",
      content: <WelcomeContent isDark={isDark} />,
      disableBeacon: true,
    },
    // 2. Dashboard
    step(
      '[data-tour="sidebar-dashboard"]', "right",
      "📊 Dashboard — Komuta Merkezi",
      "Paneli her açtığınızda gördüğünüz genel bakış ekranıdır.",
      [
        "Günlük/haftalık gelir ve rezervasyon sayıları",
        "Geçen haftaya göre değişim yüzdesi (sparkline grafik)",
        "Satış trend grafiği — bu dönem vs önceki dönem",
        "En çok satan turlar ve doluluk oranları",
      ],
      "Dashboard'daki \"Hızlı Aksiyonlar\" butonlarıyla doğrudan tur ekleyebilir veya rezervasyon yapabilirsiniz.",
    ),
    // 3. Turlar
    step(
      '[data-tour="sidebar-tours"]', "right",
      "🗺️ Turlar — Tur Yönetimi",
      "Tüm turlarınızı bu bölümden yönetirsiniz.",
      [
        "Yeni tur ekle veya mevcut turu kopyala (≡ menü → Kopyala)",
        "Excel'den toplu tur içe aktar (tüm alanlarla)",
        "6 dilde tur adı / destinasyon / program girişi",
        "\"Toplu Tarih Oluştur\" ile her cumartesi tüm ay tek tıkla",
      ],
      "Bir tur kopyalayıp sadece adını değiştirerek benzer turları dakikalar içinde oluşturabilirsiniz.",
    ),
    // 4. Rezervasyonlar
    step(
      '[data-tour="sidebar-registrations"]', "right",
      "📋 Rezervasyonlar — Kayıt Takibi",
      "WhatsApp botu ve demo chat'ten gelen tüm rezervasyonlar burada listelenir.",
      [
        "Durum değiştir: Yeni → Onaylı / İptal",
        "Onaylandığında müşteriye otomatik WhatsApp mesajı gider",
        "Gelişmiş filtreleme: tur, tarih, durum, kaynak kanal",
        "Excel'e aktar (tüm filtrelerle birlikte)",
        "Manuel rezervasyon ekle (telefon veya ofis kayıtları için)",
      ],
      "Durumu ONAYLANDI yapınca müşteriye otomatik onay mesajı gönderilir — WhatsApp'a geçmenize gerek yok.",
    ),
    // 5. WhatsApp
    step(
      '[data-tour="sidebar-whatsapp"]', "right",
      "💬 WhatsApp — Tam Kontrol Merkezi",
      "Tüm WhatsApp işlemlerinizi tek ekrandan yönetirsiniz.",
      [
        "Konuşmalar: Müşteri yazışmalarını gerçek zamanlı görün",
        "Bot'u duraklat ve müşteriye kendiniz yanıt verin",
        "Entegrasyon: WhatsApp Business hesabınızı bağlayın",
        "Dil istatistikleri: Hangi dilde kaç müşteri geldi?",
      ],
      "\"Bot'u Duraklat\" özelliği ile AI'ı devre dışı bırakıp müşteriyle bizzat konuşabilirsiniz.",
    ),
    // 6. Acente Bilgileri
    step(
      '[data-tour="sidebar-agency-info"]', "right",
      "🏢 Acente Bilgileri — Profil Ayarları",
      "Müşterilere WhatsApp üzerinden gösterilecek acente bilgilerinizi girin.",
      [
        "Adres, telefon, çalışma saatleri",
        "Web sitesi ve Google Maps linki",
        "İptal politikası metni",
      ],
      "Bu bilgiler müşteri 'Sizi nasıl bulabilirim?' dediğinde bot tarafından otomatik paylaşılır.",
    ),
    // 7. Ödeme Ayarları
    step(
      '[data-tour="sidebar-payment"]', "right",
      "💳 Ödeme Ayarları — Ödeme Bilgileri",
      "Rezervasyon tamamlandığında müşteriye gönderilecek ödeme bilgilerini ayarlayın.",
      [
        "IBAN ve banka bilgileri",
        "Ödeme talimatları metni (7 dilde ayrı ayrı girilebilir)",
        "Dile göre farklı para birimi gösterimi",
      ],
      "Müşteri ödeme yapmak istediğinde bot bu bilgileri otomatik gönderir.",
    ),
    // 8. Mesaj Şablonları
    step(
      '[data-tour="sidebar-templates"]', "right",
      "📨 Mesaj Şablonları — Otomatik Mesajlar",
      "Rezervasyon onayı, iptali ve tur hatırlatma mesajlarını özelleştirin.",
      [
        "7 dilde ayrı şablon yazın",
        "Meta WhatsApp ile senkronize edin (ONAYLANDI/REDDEDİLDİ durumu)",
        "Şablon gönder: Belirli bir müşteriye manuel şablon gönderin",
        "Değişkenler: {full_name}, {tour_name}, {date}, {pax}",
      ],
      "\"Varsayılanları Yükle\" ile hazır şablonları 1 tıkla alabilirsiniz.",
    ),
    // 9. SSS
    step(
      '[data-tour="sidebar-faq"]', "right",
      "❓ SSS & Otomatik Yanıtlar",
      "\"Fiyat ne kadar?\" gibi sık sorulan soruları AI'a öğretin.",
      [
        "Soru + otomatik yanıt çiftleri ekleyin",
        "Kategori ve dil bazında organize edin",
        "Bot bu soruları algılayınca direkt yanıtlar",
        "AI'a yük azaltır, yanıt hızını artırır",
      ],
      "Ne kadar çok SSS girerseniz bot o kadar doğru ve hızlı yanıt verir.",
    ),
    // 10. Dil Yönetimi
    step(
      '[data-tour="sidebar-languages"]', "right",
      "🌍 Dil Yönetimi — Çok Dil Desteği",
      "Botunuzun hangi dillerde hizmet vereceğini ayarlayın.",
      [
        "7 dil: TR, EN, DE, FR, ES, RU, AR",
        "Her dil için ayrı para birimi tanımlayın",
        "Müşteri dili otomatik algılanır",
        "Arapça için RTL (sağdan sola) otomatik aktif",
      ],
      "En az 1 dil seçilmezse bot çalışmaz. Dashboard'daki uyarıya dikkat edin.",
    ),
    // 11. Planım
    step(
      '[data-tour="sidebar-history"]', "right",
      "💎 Planım — Abonelik & Kota",
      "Mevcut planınızı ve mesaj kotanızı buradan takip edin.",
      [
        "Aylık mesaj kullanımı ve limit",
        "Abonelik geçmişi ve fatura",
        "Plan yükseltme seçenekleri",
        "Ekstra kota satın alma",
      ],
      "Header'daki turuncu banner mesaj kotanız dolmadan uyarır.",
    ),
    // 12. Bildirimler
    step(
      '[data-tour="header-notifications"]', "bottom",
      "🔔 Bildirimler — Anlık Haberdar Ol",
      "Yeni rezervasyon geldiğinde panelde ve tarayıcıda anında bildirim alırsınız.",
      [
        "Zil ikonundaki kırmızı badge okunmamış sayısını gösterir",
        "Tıklayarak rezervasyonlar ekranına geçiş yapın",
        "Tarayıcı izni verirseniz sayfa kapalıyken de bildirim gelir",
      ],
    ),
    // 13. Cmd+K
    step(
      '[data-tour="header-command-palette"]', "bottom",
      "⚡ Hızlı Erişim — Ctrl+K",
      "Klavye kısayoluyla her şeye anında ulaşın.",
      [
        "Ctrl+K (Mac: Cmd+K) ile paleti açın",
        "Sayfa adı yazarak anında geçiş yapın",
        "Yeni tur, rezervasyon, Excel import başlatın",
        "Koyu/açık mod değiştirin, dil seçin",
      ],
      "Power user özelliği: Mouse kullanmadan tüm paneli yönetebilirsiniz.",
    ),
    // 14. Complete
    {
      target: "body",
      placement: "center",
      title: "🚀 Hazırsınız!",
      content: <CompleteContent isDark={isDark} />,
      disableBeacon: true,
    },
  ];

  const mobileSteps: Step[] = [
    {
      target: "body",
      placement: "center",
      title: "🎉 Turzz AI'a Hoş Geldiniz!",
      content: <WelcomeContent isDark={isDark} />,
      disableBeacon: true,
    },
    step(
      '[data-tour="mobile-menu-button"]', "bottom",
      "☰ Sol Menü",
      "Sol üstteki menü ikonuna dokunarak tüm panel bölümlerine ulaşabilirsiniz.",
      ["Turlar, rezervasyonlar, WhatsApp, ayarlar ve daha fazlası"],
    ),
    step(
      '[data-tour="header-notifications"]', "bottom",
      "🔔 Bildirimler",
      "Yeni rezervasyon geldiğinde zil ikonunda kırmızı badge görünür.",
      ["Tıklayarak rezervasyonlar ekranına geçiş yapın"],
    ),
    {
      target: "body",
      placement: "center",
      title: "🚀 Hazırsınız!",
      content: <CompleteContent isDark={isDark} />,
      disableBeacon: true,
    },
  ];

  const steps = isMobile ? mobileSteps : desktopSteps;

  useEffect(() => {
    if (shouldRun) {
      const timer = setTimeout(() => {
        // localStorage'a hemen yaz — sekme kapansa bile bir daha gösterilmez
        if (agencyId) localStorage.setItem(STORAGE_KEY(agencyId), "1");
        setRunTour(true);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [shouldRun, agencyId]);

  const handleCallback = (data: CallBackProps) => {
    const { status, type } = data;
    const ended =
      type === EVENTS.TOUR_END ||
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED;
    if (ended) {
      setRunTour(false);
      localStorage.setItem(STORAGE_KEY(agencyId), "1");
      onComplete();
    }
  };

  if (!runTour) return null;

  return (
    <Joyride
      steps={steps}
      run={runTour}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableOverlayClose
      spotlightClicks
      callback={handleCallback}
      locale={{
        back: "← Geri",
        close: "Kapat",
        last: "Başlayalım! 🚀",
        next: "İleri →",
        skip: "Atla",
      }}
      styles={{
        options: {
          backgroundColor: bg,
          textColor: fg,
          primaryColor: "hsl(16 95% 55%)",
          arrowColor: bg,
          overlayColor: "rgba(0,0,0,0.6)",
          spotlightShadow: "0 0 0 3px hsl(16 95% 55% / 0.4), 0 0 30px rgba(0,0,0,0.3)",
          zIndex: 10000,
          width: isMobile ? 320 : 460,
        },
        tooltip: {
          borderRadius: 14,
          padding: "20px 22px",
          boxShadow: isDark
            ? "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)"
            : "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)",
        },
        tooltipTitle: {
          fontSize: 17,
          fontWeight: 700,
          marginBottom: 10,
          color: fg,
          lineHeight: 1.4,
        },
        tooltipContent: {
          padding: "0 0 4px",
          fontSize: 14,
        },
        tooltipFooter: {
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
        },
        buttonNext: {
          backgroundColor: "hsl(16 95% 55%)",
          borderRadius: 8,
          padding: "9px 20px",
          fontSize: 14,
          fontWeight: 600,
          border: "none",
          boxShadow: "0 2px 8px rgba(249,115,22,0.35)",
          cursor: "pointer",
        },
        buttonBack: {
          color: isDark ? "#64748b" : "#94a3b8",
          fontSize: 13,
          marginRight: 10,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        },
        buttonSkip: {
          color: isDark ? "#64748b" : "#94a3b8",
          fontSize: 13,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        },
        buttonClose: {
          color: isDark ? "#64748b" : "#94a3b8",
          width: 28,
          height: 28,
        },
        spotlight: {
          borderRadius: 10,
        },
        overlay: {
          mixBlendMode: "normal",
        },
      }}
    />
  );
}

export { STORAGE_KEY as tourStorageKey };
