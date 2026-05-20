const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/i18n/locales');
const langs = ['en','de','fr','es','ru','ar'];

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

function unflatten(flat) {
  const result = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cur)) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return result;
}

const tr = flatten(JSON.parse(fs.readFileSync(path.join(localesDir, 'tr.json'), 'utf8')));
const en = flatten(JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')));

// Only admin-related missing keys for each lang
const adminPrefixes = ['admin.', 'conversations.', 'tours.', 'registrations.', 'bulkDates.',
  'bulkImport.', 'agencyInfo.', 'complaints.', 'feedback.', 'notifications.',
  'languageManagement.', 'tickets.', 'help.', 'onboardingTour.', 'dashboard.', 'greetings.',
  'commandPalette.', 'gettingStarted.', 'auth.', 'common.', 'weekdays.'];

for (const lang of langs) {
  const langData = flatten(JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8')));
  const missing = {};
  for (const key of Object.keys(tr)) {
    if (!(key in langData)) {
      const isAdmin = adminPrefixes.some(p => key.startsWith(p));
      if (isAdmin) {
        missing[key] = { tr: tr[key], en: en[key] || tr[key] };
      }
    }
  }
  const outFile = path.join(__dirname, `missing_${lang}.json`);
  fs.writeFileSync(outFile, JSON.stringify(missing, null, 2), 'utf8');
  console.log(`${lang}: ${Object.keys(missing).length} admin missing key → scripts/missing_${lang}.json`);
}
