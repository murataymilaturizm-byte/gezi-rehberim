// Turzz turuncu paletinde stilize AI robot kafası — saf SVG + CSS.
// Animasyonlar: hafif "nefes" (float), göz kırpma, "düşünme" anteni.
// Library yok (Lottie/3D yok). Erişilebilir: aria-hidden (dekoratif).

interface AIMascotProps {
  /** Bot şu an "düşünüyor" mu? Anten/ışık parlaması bu duruma bağlı. */
  thinking?: boolean;
  className?: string;
}

export const AIMascot = ({ thinking = false, className = "" }: AIMascotProps) => {
  return (
    <div
      aria-hidden="true"
      className={`relative w-full max-w-[200px] mx-auto select-none ${className}`}
    >
      <div className="animate-mascot-breathe">
        <svg
          viewBox="0 0 200 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto drop-shadow-[0_8px_24px_hsl(16_45%_35%/0.25)]"
        >
          {/* Anten - thinking modunda hızlı parlar */}
          <line x1="100" y1="35" x2="100" y2="15" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
          <circle
            cx="100"
            cy="12"
            r="6"
            fill="hsl(var(--primary))"
            className={thinking ? "animate-mascot-think" : "animate-mascot-breathe"}
          />
          {thinking && (
            <circle
              cx="100"
              cy="12"
              r="10"
              fill="hsl(var(--primary) / 0.4)"
              className="animate-mascot-think"
            />
          )}

          {/* Robot kafası — yumuşak köşeli kare, gradient dolgu */}
          <defs>
            <linearGradient id="mascot-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(16 95% 55%)" />
              <stop offset="100%" stopColor="hsl(28 90% 60%)" />
            </linearGradient>
            <linearGradient id="mascot-face" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(0 0% 100% / 0.95)" />
              <stop offset="100%" stopColor="hsl(42 100% 97%)" />
            </linearGradient>
          </defs>

          {/* Dış gövde */}
          <rect x="35" y="40" width="130" height="130" rx="32" fill="url(#mascot-grad)" />
          {/* Yüz panel */}
          <rect x="50" y="60" width="100" height="90" rx="20" fill="url(#mascot-face)" />

          {/* Gözler — animate-mascot-blink ile periyodik kırpma */}
          <g className="animate-mascot-blink" style={{ transformOrigin: "78px 100px" }}>
            <circle cx="78" cy="100" r="9" fill="hsl(20 25% 15%)" />
            <circle cx="80" cy="97" r="3" fill="hsl(0 0% 100%)" />
          </g>
          <g className="animate-mascot-blink" style={{ transformOrigin: "122px 100px", animationDelay: "0.1s" }}>
            <circle cx="122" cy="100" r="9" fill="hsl(20 25% 15%)" />
            <circle cx="124" cy="97" r="3" fill="hsl(0 0% 100%)" />
          </g>

          {/* Ağız — yumuşak gülümseme */}
          <path
            d="M 80 128 Q 100 142 120 128"
            stroke="hsl(20 25% 15%)"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Yanak işaretleri — sıcak tonlama */}
          <circle cx="62" cy="125" r="4" fill="hsl(16 95% 70% / 0.5)" />
          <circle cx="138" cy="125" r="4" fill="hsl(16 95% 70% / 0.5)" />

          {/* Boyun + gövde tabanı */}
          <rect x="80" y="170" width="40" height="20" rx="6" fill="hsl(var(--primary) / 0.7)" />
          <rect x="60" y="190" width="80" height="22" rx="10" fill="url(#mascot-grad)" />

          {/* Yan ışıklar - thinking ise parlasın */}
          <circle cx="42" cy="105" r="5" fill={thinking ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"} className={thinking ? "animate-mascot-think" : ""} />
          <circle cx="158" cy="105" r="5" fill={thinking ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"} className={thinking ? "animate-mascot-think" : ""} />
        </svg>
      </div>
    </div>
  );
};
