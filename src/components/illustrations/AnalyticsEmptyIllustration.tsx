// CSS değişkenli boş durum illüstrasyonu — Wave 5 tasarım diliyle uyumlu.

export function AnalyticsEmptyIllustration({ className = "w-40 h-40" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Arka plan dairesi */}
      <circle cx="80" cy="80" r="72" fill="hsl(var(--primary) / 0.08)" />

      {/* Grafik kartı arka planı */}
      <rect x="32" y="50" width="96" height="70" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />

      {/* Grafik eksenleri */}
      <line x1="40" y1="106" x2="120" y2="106" stroke="hsl(var(--border))" strokeWidth="1" />
      <line x1="40" y1="62" x2="40" y2="106" stroke="hsl(var(--border))" strokeWidth="1" />

      {/* Bar'lar — yükselen trend */}
      <rect x="48" y="90" width="10" height="16" rx="1.5" fill="hsl(var(--primary) / 0.4)" />
      <rect x="64" y="82" width="10" height="24" rx="1.5" fill="hsl(var(--primary) / 0.55)" />
      <rect x="80" y="74" width="10" height="32" rx="1.5" fill="hsl(var(--primary) / 0.7)" />
      <rect x="96" y="68" width="10" height="38" rx="1.5" fill="hsl(var(--primary))" />

      {/* Trend çizgisi */}
      <path
        d="M53 88 L69 80 L85 72 L101 66"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Trend noktaları */}
      <circle cx="53" cy="88" r="2.5" fill="hsl(var(--primary))" />
      <circle cx="69" cy="80" r="2.5" fill="hsl(var(--primary))" />
      <circle cx="85" cy="72" r="2.5" fill="hsl(var(--primary))" />
      <circle cx="101" cy="66" r="2.5" fill="hsl(var(--primary))" />

      {/* Yükselen ok */}
      <circle cx="112" cy="108" r="14" fill="hsl(var(--primary))" />
      <path
        d="M108 112 L112 105 L116 112 M112 105 L112 113"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
