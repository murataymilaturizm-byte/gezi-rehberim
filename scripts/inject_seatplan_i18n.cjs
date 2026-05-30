// One-shot: Faz 2-B Koltuk Planı i18n anahtarları 7 dile inject. İdempotent.
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const T = {
  tr: {
    openButton: "Koltuk Planı",
    title: "Koltuk Planı",
    settings: "Sefer Ayarları",
    transportType: "Sefer Tipi",
    transportTypes: { BUS: "Otobüs", PLANE: "Uçak", BOAT: "Tekne", PRIVATE: "Özel Araç", OTHER: "Diğer" },
    layout: "Düzen",
    seatCount: "Koltuk Sayısı",
    seats: "koltuk",
    vehiclePlate: "Plaka",
    guideName: "Rehber",
    notBus: "Bu sefer otobüs değil. Koltuk planı sadece otobüs seferlerinde kullanılır.",
    fillRequired: "Düzen ve koltuk sayısı zorunlu",
    saved: "Sefer ayarları kaydedildi",
    saveError: "Kaydedilemedi",
    save: "Kaydet",
    autoAssign: "Otomatik Ata",
    autoAssignDone: "Otomatik atama tamamlandı",
    allAssigned: "Tüm yolcular atandı",
    passengerShort: "yolcu",
    unassigned: "Atanmamış Yolcular",
    noUnassigned: "Atanmamış yolcu yok",
    assigned: "atandı",
    empty: "Boş",
    full: "Koltuk dolu",
    assignPassenger: "Yolcu Ata",
    removeAssignment: "Atamayı Kaldır",
    assignError: "Atama başarısız",
    loadError: "Koltuk planı yüklenemedi",
    exportPdf: "PDF İndir",
    pdfError: "PDF oluşturulamadı",
    totalAssigned: "Toplam Atanan"
  },
  en: {
    openButton: "Seat Plan",
    title: "Seat Plan",
    settings: "Trip Settings",
    transportType: "Transport Type",
    transportTypes: { BUS: "Bus", PLANE: "Plane", BOAT: "Boat", PRIVATE: "Private Vehicle", OTHER: "Other" },
    layout: "Layout",
    seatCount: "Seat Count",
    seats: "seats",
    vehiclePlate: "Plate Number",
    guideName: "Guide",
    notBus: "This trip is not a bus trip. Seat plan is only used for bus trips.",
    fillRequired: "Layout and seat count are required",
    saved: "Trip settings saved",
    saveError: "Could not save",
    save: "Save",
    autoAssign: "Auto-Assign",
    autoAssignDone: "Auto-assignment complete",
    allAssigned: "All passengers assigned",
    passengerShort: "passenger(s)",
    unassigned: "Unassigned Passengers",
    noUnassigned: "No unassigned passengers",
    assigned: "assigned",
    empty: "Empty",
    full: "Seat is full",
    assignPassenger: "Assign Passenger",
    removeAssignment: "Remove Assignment",
    assignError: "Assignment failed",
    loadError: "Could not load seat plan",
    exportPdf: "Download PDF",
    pdfError: "Could not generate PDF",
    totalAssigned: "Total Assigned"
  },
  de: {
    openButton: "Sitzplan",
    title: "Sitzplan",
    settings: "Fahrteinstellungen",
    transportType: "Verkehrsmittel",
    transportTypes: { BUS: "Bus", PLANE: "Flugzeug", BOAT: "Boot", PRIVATE: "Privatfahrzeug", OTHER: "Andere" },
    layout: "Anordnung",
    seatCount: "Sitzanzahl",
    seats: "Sitze",
    vehiclePlate: "Kennzeichen",
    guideName: "Reiseleiter",
    notBus: "Diese Fahrt ist keine Busfahrt. Sitzplan wird nur für Busfahrten verwendet.",
    fillRequired: "Anordnung und Sitzanzahl sind erforderlich",
    saved: "Fahrteinstellungen gespeichert",
    saveError: "Konnte nicht gespeichert werden",
    save: "Speichern",
    autoAssign: "Automatisch zuweisen",
    autoAssignDone: "Automatische Zuweisung abgeschlossen",
    allAssigned: "Alle Passagiere zugewiesen",
    passengerShort: "Passagier(e)",
    unassigned: "Nicht zugewiesene Passagiere",
    noUnassigned: "Keine nicht zugewiesenen Passagiere",
    assigned: "zugewiesen",
    empty: "Leer",
    full: "Sitz belegt",
    assignPassenger: "Passagier zuweisen",
    removeAssignment: "Zuweisung entfernen",
    assignError: "Zuweisung fehlgeschlagen",
    loadError: "Sitzplan konnte nicht geladen werden",
    exportPdf: "PDF herunterladen",
    pdfError: "PDF konnte nicht erstellt werden",
    totalAssigned: "Gesamt zugewiesen"
  },
  fr: {
    openButton: "Plan des sièges",
    title: "Plan des sièges",
    settings: "Paramètres du voyage",
    transportType: "Type de transport",
    transportTypes: { BUS: "Bus", PLANE: "Avion", BOAT: "Bateau", PRIVATE: "Véhicule privé", OTHER: "Autre" },
    layout: "Disposition",
    seatCount: "Nombre de sièges",
    seats: "sièges",
    vehiclePlate: "Plaque",
    guideName: "Guide",
    notBus: "Ce voyage n'est pas en bus. Le plan des sièges n'est utilisé que pour les voyages en bus.",
    fillRequired: "La disposition et le nombre de sièges sont requis",
    saved: "Paramètres du voyage enregistrés",
    saveError: "Échec de l'enregistrement",
    save: "Enregistrer",
    autoAssign: "Attribution automatique",
    autoAssignDone: "Attribution automatique terminée",
    allAssigned: "Tous les passagers attribués",
    passengerShort: "passager(s)",
    unassigned: "Passagers non attribués",
    noUnassigned: "Aucun passager non attribué",
    assigned: "attribué",
    empty: "Vide",
    full: "Siège occupé",
    assignPassenger: "Attribuer un passager",
    removeAssignment: "Supprimer l'attribution",
    assignError: "Attribution échouée",
    loadError: "Impossible de charger le plan des sièges",
    exportPdf: "Télécharger PDF",
    pdfError: "Impossible de générer le PDF",
    totalAssigned: "Total attribué"
  },
  es: {
    openButton: "Plan de asientos",
    title: "Plan de asientos",
    settings: "Configuración del viaje",
    transportType: "Tipo de transporte",
    transportTypes: { BUS: "Autobús", PLANE: "Avión", BOAT: "Barco", PRIVATE: "Vehículo privado", OTHER: "Otro" },
    layout: "Distribución",
    seatCount: "Cantidad de asientos",
    seats: "asientos",
    vehiclePlate: "Matrícula",
    guideName: "Guía",
    notBus: "Este viaje no es en autobús. El plan de asientos solo se usa para viajes en autobús.",
    fillRequired: "Distribución y cantidad de asientos son obligatorias",
    saved: "Configuración del viaje guardada",
    saveError: "No se pudo guardar",
    save: "Guardar",
    autoAssign: "Asignar automáticamente",
    autoAssignDone: "Asignación automática completa",
    allAssigned: "Todos los pasajeros asignados",
    passengerShort: "pasajero(s)",
    unassigned: "Pasajeros no asignados",
    noUnassigned: "No hay pasajeros sin asignar",
    assigned: "asignado",
    empty: "Vacío",
    full: "Asiento ocupado",
    assignPassenger: "Asignar pasajero",
    removeAssignment: "Quitar asignación",
    assignError: "Asignación fallida",
    loadError: "No se pudo cargar el plan de asientos",
    exportPdf: "Descargar PDF",
    pdfError: "No se pudo generar el PDF",
    totalAssigned: "Total asignado"
  },
  ru: {
    openButton: "План мест",
    title: "План мест",
    settings: "Настройки рейса",
    transportType: "Тип транспорта",
    transportTypes: { BUS: "Автобус", PLANE: "Самолёт", BOAT: "Лодка", PRIVATE: "Личный транспорт", OTHER: "Другое" },
    layout: "Схема",
    seatCount: "Количество мест",
    seats: "мест",
    vehiclePlate: "Номер",
    guideName: "Гид",
    notBus: "Этот рейс не автобусный. План мест используется только для автобусных рейсов.",
    fillRequired: "Схема и количество мест обязательны",
    saved: "Настройки рейса сохранены",
    saveError: "Не удалось сохранить",
    save: "Сохранить",
    autoAssign: "Автоназначение",
    autoAssignDone: "Автоназначение завершено",
    allAssigned: "Все пассажиры назначены",
    passengerShort: "пассажир(ов)",
    unassigned: "Неназначенные пассажиры",
    noUnassigned: "Нет неназначенных пассажиров",
    assigned: "назначено",
    empty: "Пусто",
    full: "Место занято",
    assignPassenger: "Назначить пассажира",
    removeAssignment: "Снять назначение",
    assignError: "Назначение не удалось",
    loadError: "Не удалось загрузить план мест",
    exportPdf: "Скачать PDF",
    pdfError: "Не удалось создать PDF",
    totalAssigned: "Всего назначено"
  },
  ar: {
    openButton: "مخطط المقاعد",
    title: "مخطط المقاعد",
    settings: "إعدادات الرحلة",
    transportType: "نوع النقل",
    transportTypes: { BUS: "حافلة", PLANE: "طائرة", BOAT: "قارب", PRIVATE: "مركبة خاصة", OTHER: "أخرى" },
    layout: "التخطيط",
    seatCount: "عدد المقاعد",
    seats: "مقاعد",
    vehiclePlate: "اللوحة",
    guideName: "المرشد",
    notBus: "هذه الرحلة ليست بالحافلة. يُستخدم مخطط المقاعد فقط لرحلات الحافلات.",
    fillRequired: "التخطيط وعدد المقاعد مطلوبان",
    saved: "تم حفظ إعدادات الرحلة",
    saveError: "تعذر الحفظ",
    save: "حفظ",
    autoAssign: "تعيين تلقائي",
    autoAssignDone: "اكتمل التعيين التلقائي",
    allAssigned: "تم تعيين جميع المسافرين",
    passengerShort: "مسافر(ون)",
    unassigned: "مسافرون غير معينين",
    noUnassigned: "لا يوجد مسافرون غير معينين",
    assigned: "معين",
    empty: "فارغ",
    full: "المقعد ممتلئ",
    assignPassenger: "تعيين مسافر",
    removeAssignment: "إزالة التعيين",
    assignError: "فشل التعيين",
    loadError: "تعذر تحميل مخطط المقاعد",
    exportPdf: "تنزيل PDF",
    pdfError: "تعذر إنشاء PDF",
    totalAssigned: "إجمالي المعينين"
  }
};

const COMMON_ADD = {
  tr: { close: "Kapat" }, en: { close: "Close" }, de: { close: "Schließen" },
  fr: { close: "Fermer" }, es: { close: "Cerrar" }, ru: { close: "Закрыть" },
  ar: { close: "إغلاق" }
};

function deepInjectIfAbsent(target, source) {
  for (const k of Object.keys(source)) {
    if (typeof source[k] === "object" && source[k] !== null && !Array.isArray(source[k])) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepInjectIfAbsent(target[k], source[k]);
    } else {
      if (!target[k]) target[k] = source[k];
    }
  }
}

function inject(lang) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.admin || typeof obj.admin !== "object") obj.admin = {};
  if (!obj.admin.seatPlan || typeof obj.admin.seatPlan !== "object") obj.admin.seatPlan = {};
  deepInjectIfAbsent(obj.admin.seatPlan, T[lang]);

  if (!obj.common || typeof obj.common !== "object") obj.common = {};
  deepInjectIfAbsent(obj.common, COMMON_ADD[lang]);

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] seatPlan + common.close injected`);
}

for (const lang of Object.keys(T)) {
  try { inject(lang); }
  catch (e) { console.error(`[${lang}] FAILED:`, e.message); process.exitCode = 1; }
}
