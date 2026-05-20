const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/i18n/locales');
const langs = ['tr','en','de','fr','es','ru','ar'];

function flatten(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flatten(v, key));
    } else {
      result[key] = v;
    }
  }
  return result;
}

const data = {};
for (const lang of langs) {
  const raw = JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'));
  data[lang] = flatten(raw);
}

const trKeys = Object.keys(data.tr);

console.log('=== i18n AUDIT RAPORU ===\n');
console.log(`TR toplam key: ${trKeys.length}\n`);

let totalMissing = 0;
for (const lang of langs.filter(l => l !== 'tr')) {
  const missing = trKeys.filter(k => !(k in data[lang]));
  const empty = trKeys.filter(k => (k in data[lang]) && data[lang][k] === '');
  // TR value kalmış (başka dilde TR metin — Türkçe karakter kontrolü)
  const trLeft = trKeys.filter(k => {
    if (!(k in data[lang])) return false;
    const val = String(data[lang][k]);
    return /[çğışöüÇĞİŞÖÜ]/.test(val);
  });
  console.log(`--- ${lang.toUpperCase()} ---`);
  console.log(`  Eksik: ${missing.length} key`);
  console.log(`  Boş: ${empty.length} key`);
  console.log(`  TR kalmış: ${trLeft.length} key`);
  if (missing.length > 0) {
    console.log('  Eksik key örnekleri (ilk 20):');
    missing.slice(0,20).forEach(k => console.log(`    - ${k}`));
    if (missing.length > 20) console.log(`    ... ve ${missing.length-20} tane daha`);
  }
  if (trLeft.length > 0 && trLeft.length <= 10) {
    console.log('  TR kalmış key\'ler:');
    trLeft.forEach(k => console.log(`    - ${k}: "${data[lang][k]}"`));
  }
  console.log('');
  totalMissing += missing.length;
}

console.log(`Toplam eksik key (tüm diller): ${totalMissing}`);
