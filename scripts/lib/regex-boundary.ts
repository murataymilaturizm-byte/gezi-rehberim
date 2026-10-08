// Dilim-7 (denetim E2): JS `\b` yalnız ASCII [A-Za-z0-9_] için sınır üretir. `\b`'ye
// BİTİŞİK karakter non-ASCII ise (ü, ç, Kiril, Arap...) sınır hiç oluşmaz → o alternatif
// ölüdür ("да", "نعم", "überspringen" asla eşleşmez). Bu modül bir regex kaynağında
// `\b`'ye bitişik alternatiflerin İLK (öndeki \b) / SON (arkadaki \b) atomunu çıkarır;
// atom non-ASCII ise ihlaldir. Kural: \p{L}\p{N} lookaround kullan.
// Tüketici: scripts/test_behavioral.ts (D7.E2 statik muhafız).

const NONASCII = /[^\x00-\x7F]/;

/** src[i] === "(" için eşleşen ")" indeksini döndürür. */
function closeParen(src: string, i: number): number {
  let d = 0, inClass = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") { j++; continue; }
    if (inClass) { if (c === "]") inClass = false; continue; }
    if (c === "[") { inClass = true; continue; }
    if (c === "(") d++;
    else if (c === ")") { d--; if (d === 0) return j; }
  }
  return -1;
}
/** src[i] === ")" için eşleşen "(" indeksini döndürür. */
function openParen(src: string, i: number): number {
  for (let j = 0; j <= i; j++) if (src[j] === "(" && !escaped(src, j) && closeParen(src, j) === i) return j;
  return -1;
}
function escaped(src: string, i: number): boolean {
  let n = 0;
  for (let j = i - 1; j >= 0 && src[j] === "\\"; j--) n++;
  return n % 2 === 1;
}
/** Grup içeriğini üst-seviye "|" ile böler. */
function splitAlts(body: string): string[] {
  const out: string[] = [];
  let d = 0, inClass = false, start = 0;
  for (let j = 0; j < body.length; j++) {
    const c = body[j];
    if (c === "\\") { j++; continue; }
    if (inClass) { if (c === "]") inClass = false; continue; }
    if (c === "[") inClass = true;
    else if (c === "(") d++;
    else if (c === ")") d--;
    else if (c === "|" && d === 0) { out.push(body.slice(start, j)); start = j + 1; }
  }
  out.push(body.slice(start));
  return out;
}
const groupBody = (g: string) => g.replace(/^\((?:\?(?::|<?[=!]|<[\w$]+>))?/, "").replace(/\)$/, "");

/** Alternatifin ilk atomu non-ASCII mi? (opsiyonel önek grubu da ilk atom sayılır.) */
function firstAtomNonAscii(alt: string): boolean {
  if (!alt) return false;
  const c = alt[0];
  if (c === "(") {
    const e = closeParen(alt, 0);
    if (e < 0) return false;
    if (splitAlts(groupBody(alt.slice(0, e + 1))).some(firstAtomNonAscii)) return true;
    // grup opsiyonelse (?, *) sonraki atom da ilk olabilir
    return /[?*]/.test(alt[e + 1] ?? "") ? firstAtomNonAscii(alt.slice(e + 2)) : false;
  }
  if (c === "[") { const e = alt.indexOf("]", 1); return NONASCII.test(alt.slice(0, e + 1)); }
  if (c === "\\") return false; // \s \d \S ... ASCII sınıflar
  return NONASCII.test(c);
}
/** Alternatifin son atomu non-ASCII mi? */
function lastAtomNonAscii(alt: string): boolean {
  let s = alt.replace(/(?:[?*+]|\{\d+(?:,\d*)?\})+$/, "");
  if (!s) return false;
  const c = s[s.length - 1];
  if (c === ")" && !escaped(s, s.length - 1)) {
    const o = openParen(s, s.length - 1);
    return o >= 0 && splitAlts(groupBody(s.slice(o))).some(lastAtomNonAscii);
  }
  if (c === "]" && !escaped(s, s.length - 1)) { const o = s.lastIndexOf("["); return NONASCII.test(s.slice(o)); }
  if (escaped(s, s.length - 1)) return false;
  return NONASCII.test(c);
}

/** Regex kaynağında ihlal eden \b konumlarının kısa bağlamlarını döndürür. */
export function deadBoundaries(src: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < src.length - 1; i++) {
    if (src[i] !== "\\") continue;
    if (src[i + 1] !== "b") { i++; continue; }
    const ctx = src.slice(Math.max(0, i - 20), i + 22);
    // Sağ taraf (öndeki \b): \b( ... ) ya da \bX
    const r = src.slice(i + 2);
    let bad = false;
    if (r.startsWith("(")) {
      const e = closeParen(r, 0);
      if (e > 0) bad = splitAlts(groupBody(r.slice(0, e + 1))).some(firstAtomNonAscii) || (/[?*]/.test(r[e + 1] ?? "") && firstAtomNonAscii(r.slice(e + 2)));
    } else bad = firstAtomNonAscii(r);
    // Sol taraf (arkadaki \b): ( ... )\b ya da X\b — yalnız sola bakılır
    if (!bad && i > 0) bad = lastAtomNonAscii(src.slice(0, i));
    // Sol tarafın kendisi bir alternatif grubunun içindeyse, yalnız o alternatif
    if (bad) out.push(ctx);
    i++;
  }
  return out;
}

/** Bir satırdaki regex literal'lerini kaba ama yeterli bir desenle çıkarır. */
export const REGEX_LITERAL = /\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n\[])+\/[dgimsuyv]*/g;
