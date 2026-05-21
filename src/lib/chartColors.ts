// Recharts için CSS değişkenli renk palette (dark/light tema uyumu).
// Recharts SVG'de hsl(var(--primary)) gibi CSS değişkeni KABUL ETMEZ —
// runtime'da getComputedStyle ile çözeriz.

const cssVarToHsl = (varName: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!raw) return fallback;
    // CSS değişkeni "210 40% 50%" şeklinde olabilir → hsl() ile sarmala
    if (raw.includes('%')) return `hsl(${raw})`;
    return raw;
  } catch {
    return fallback;
  }
};

export const getChartColors = (): string[] => {
  // Primary + sıralı vurgu renkleri (Tailwind palette'inden esinli)
  return [
    cssVarToHsl('--primary', '#3b82f6'),       // primary
    cssVarToHsl('--chart-2', '#10b981'),       // emerald
    cssVarToHsl('--chart-3', '#f59e0b'),       // amber
    cssVarToHsl('--chart-4', '#ef4444'),       // red
    cssVarToHsl('--chart-5', '#8b5cf6'),       // violet
    cssVarToHsl('--chart-6', '#06b6d4'),       // cyan
    cssVarToHsl('--chart-7', '#ec4899'),       // pink
    cssVarToHsl('--chart-8', '#84cc16'),       // lime
  ];
};
