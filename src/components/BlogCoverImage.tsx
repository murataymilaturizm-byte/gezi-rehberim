import { useState } from "react";

interface BlogCoverImageProps {
  title: string;
  category: string;
  image?: string;
  size?: "card" | "hero";
  className?: string;
}

// Kategori → gradient renkleri + emoji
const THEMES: Record<string, { c1: string; c2: string; c3: string; emoji: string }> = {
  "Rehber":             { c1: "#f97316", c2: "#ea580c", c3: "#9a3412", emoji: "📚" },
  "AI":                 { c1: "#8b5cf6", c2: "#7c3aed", c3: "#4c1d95", emoji: "🤖" },
  "WhatsApp":           { c1: "#16a34a", c2: "#15803d", c3: "#14532d", emoji: "💬" },
  "Müşteri Yönetimi":   { c1: "#0891b2", c2: "#0e7490", c3: "#164e63", emoji: "👥" },
  "Satış & Pazarlama":  { c1: "#e11d48", c2: "#be123c", c3: "#881337", emoji: "📈" },
  "İncoming Turizm":    { c1: "#0284c7", c2: "#0369a1", c3: "#0c4a6e", emoji: "✈️" },
  "Otomasyon":          { c1: "#7c3aed", c2: "#6d28d9", c3: "#3b0764", emoji: "⚡" },
  "Genel":              { c1: "#475569", c2: "#334155", c3: "#0f172a", emoji: "📝" },
};
const FALLBACK = { c1: "#f97316", c2: "#ea580c", c3: "#7c3aed", emoji: "✨" };

// SVG'de otomatik text wrap yok, manuel böl
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length <= maxChars) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function CoverSVG({ title, category, isHero }: { title: string; category: string; isHero: boolean }) {
  const theme = THEMES[category] ?? FALLBACK;

  // viewBox boyutları
  const vw = isHero ? 1200 : 600;
  const vh = isHero ? 630  : 315;

  // Başlık satırları
  const maxChars  = isHero ? 38 : 26;
  const fontSize  = isHero ? 56 : 30;
  const lineH     = isHero ? 72 : 42;
  const lines     = wrapText(title, maxChars);
  const blockH    = lines.length * lineH;
  const startY    = (vh / 2) - (blockH / 2) + lineH * 0.75; // ilk satır baseline

  // Benzersiz gradyan ID (kategori + boyut karışımı)
  const gid = `g${(category + String(isHero)).split("").reduce((a, c) => a ^ c.charCodeAt(0), 0)}`;

  // Kategori badge boyutu
  const badgePad  = isHero ? 28 : 18;
  const badgeFontSize = isHero ? 16 : 12;
  const badgeH    = isHero ? 38 : 26;
  const charW     = isHero ? 9.5 : 7;
  const badgeW    = category.length * charW + badgePad * 2;
  const badgeX    = isHero ? 44 : 24;
  const badgeY    = vh - (isHero ? 62 : 42);
  const badgeTextX = badgeX + badgeW / 2;
  const badgeTextY = badgeY + badgeH / 2;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      aria-label={title}
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={theme.c1} />
          <stop offset="55%"  stopColor={theme.c2} />
          <stop offset="100%" stopColor={theme.c3} />
        </linearGradient>
      </defs>

      {/* Arka plan */}
      <rect width={vw} height={vh} fill={`url(#${gid})`} />

      {/* Dekoratif daireler */}
      <circle cx={vw * 0.88} cy={vh * 0.14} r={vw * 0.2}  fill="white" fillOpacity="0.07" />
      <circle cx={vw * 0.1}  cy={vh * 0.86} r={vw * 0.16} fill="white" fillOpacity="0.05" />
      <circle cx={vw * 0.5}  cy={vh * 0.5}  r={vw * 0.32} fill="white" fillOpacity="0.03" />

      {/* Grid */}
      <pattern id={`gr${gid}`} width={isHero ? 40 : 24} height={isHero ? 40 : 24} patternUnits="userSpaceOnUse">
        <path
          d={`M ${isHero ? 40 : 24} 0 L 0 0 0 ${isHero ? 40 : 24}`}
          fill="none" stroke="white" strokeWidth="0.5" opacity="0.08"
        />
      </pattern>
      <rect width={vw} height={vh} fill={`url(#gr${gid})`} />

      {/* Sol üst: TURZZ AI */}
      <text
        x={isHero ? 44 : 24}
        y={isHero ? 44 : 26}
        fontFamily="system-ui,-apple-system,sans-serif"
        fontSize={isHero ? 18 : 12}
        fontWeight="700"
        fill="white"
        fillOpacity="0.75"
        letterSpacing="2"
      >
        TURZZ AI
      </text>

      {/* Sağ üst: kategori emojisi */}
      <text
        x={vw - (isHero ? 56 : 32)}
        y={isHero ? 48 : 28}
        fontSize={isHero ? 30 : 20}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {theme.emoji}
      </text>

      {/* Orta: başlık — tspan ile çok satır */}
      <text
        textAnchor="middle"
        fill="white"
        fontSize={fontSize}
        fontWeight="800"
        fontFamily="system-ui,-apple-system,sans-serif"
        style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.4))" }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x="50%" y={startY + i * lineH}>
            {line}
          </tspan>
        ))}
      </text>

      {/* Sol alt: kategori badge */}
      <rect
        x={badgeX}
        y={badgeY}
        width={badgeW}
        height={badgeH}
        rx={badgeH / 2}
        fill="white"
        fillOpacity="0.22"
      />
      <text
        x={badgeTextX}
        y={badgeTextY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="system-ui,sans-serif"
        fontSize={badgeFontSize}
        fontWeight="600"
        fill="white"
      >
        {category}
      </text>

      {/* Sağ alt: turzzai.com */}
      <text
        x={vw - (isHero ? 40 : 20)}
        y={vh - (isHero ? 20 : 12)}
        textAnchor="end"
        fontFamily="system-ui,sans-serif"
        fontSize={isHero ? 14 : 10}
        fill="white"
        fillOpacity="0.45"
      >
        turzzai.com
      </text>
    </svg>
  );
}

export function BlogCoverImage({ title, category, image, size = "card", className = "" }: BlogCoverImageProps) {
  const [imgError, setImgError] = useState(false);
  const isHero = size === "hero";
  const showSVG = !image || imgError;

  const wrapperClass = isHero
    ? `aspect-[1200/630] w-full overflow-hidden rounded-xl ${className}`
    : `aspect-video w-full overflow-hidden rounded-t-lg ${className}`;

  return (
    <div className={wrapperClass}>
      {showSVG ? (
        <CoverSVG title={title} category={category} isHero={isHero} />
      ) : (
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
          loading={isHero ? "eager" : "lazy"}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}
