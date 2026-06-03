// Admin sidebar CRM grubu için 7 dil i18n enjeksiyonu (idempotent).
//   admin.groups.customers  (yeni grup başlığı)
//   admin.tabs.customers    (yeni item etiketi)
// Eski admin.tabs.userProfiles key'i KORUNUR — başka yerde kullanılıyor olabilir.
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const VALUES = {
  tr: { group: "Müşteri Yönetimi", tab: "Müşteriler" },
  en: { group: "Customer Management", tab: "Customers" },
  de: { group: "Kundenverwaltung", tab: "Kunden" },
  fr: { group: "Gestion des clients", tab: "Clients" },
  es: { group: "Gestión de clientes", tab: "Clientes" },
  ru: { group: "Управление клиентами", tab: "Клиенты" },
  ar: { group: "إدارة العملاء", tab: "العملاء" },
};

let changes = 0;
for (const [lang, v] of Object.entries(VALUES)) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.admin) obj.admin = {};
  if (!obj.admin.groups) obj.admin.groups = {};
  if (!obj.admin.tabs) obj.admin.tabs = {};

  if (obj.admin.groups.customers !== v.group) {
    obj.admin.groups.customers = v.group;
    console.log(`[${lang}] admin.groups.customers ← "${v.group}"`);
    changes++;
  }
  if (obj.admin.tabs.customers !== v.tab) {
    obj.admin.tabs.customers = v.tab;
    console.log(`[${lang}] admin.tabs.customers ← "${v.tab}"`);
    changes++;
  }

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
}

console.log(`\nTotal CRM menu i18n changes: ${changes}`);
