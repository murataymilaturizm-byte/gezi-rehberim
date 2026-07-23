// Edge (_shared/phone.ts) ile panel (src/utils/phone.ts) normalizePhone AYNI mı?
// node scripts/phone-parity-test.mjs
const ROOT = "file:///C:/Users/LENOVO/Documents/Projeler/gezi-rehberim";
const edge = await import(`${ROOT}/supabase/functions/_shared/phone.ts`);
const panel = await import(`${ROOT}/src/utils/phone.ts`);
const corpus = [
  "0541 999 00 11", "05419990011", "+90 541 999 00 11", "+905419990011",
  "905419990011", "00905419990011", "5419990011", "0(541)999-00-11",
  "+49 30 12345678", "004930123456", "+33612345678", "+74951234567",
  "+966512345678", "", null, "whatsapp:+905321234567", "  0532 123 45 67  ",
];
let diff = 0;
for (const c of corpus) {
  const e = edge.normalizePhone(c), p = panel.normalizePhone(c);
  const de = edge.formatPhoneDisplay(e), dp = panel.formatPhoneDisplay(e);
  if (e !== p || de !== dp) { console.log(`MISMATCH "${c}": edge="${e}"/"${de}" panel="${p}"/"${dp}"`); diff++; }
}
console.log(diff === 0 ? `PARITE OK — ${corpus.length}/${corpus.length} aynı` : `PARITE FAIL — ${diff} fark`);
process.exit(diff === 0 ? 0 : 1);
