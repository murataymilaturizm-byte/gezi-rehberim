// One-shot: Faz 2-A Yolcu Listesi i18n anahtarları 7 dile inject.
// İdempotent — mevcut değer varsa override etmez.
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const TRANSLATIONS = {
  tr: {
    passengers: {
      title: "Yolcu Listesi",
      description: "Her yolcunun bilgilerini girin. Boş bırakılırsa placeholder olarak kalır.",
      fullName: "Ad Soyad",
      identityNo: "Kimlik No",
      passportNo: "Pasaport No",
      birthDate: "Doğum Tarihi",
      isChild: "Çocuk",
      addPassenger: "Yolcu Ekle",
      removePassenger: "Yolcu Sil",
      save: "Kaydet",
      saved: "Yolcular kaydedildi",
      added: "Yolcu eklendi",
      removed: "Yolcu silindi",
      error: "Yolcu kaydı başarısız",
      empty: "Yolcu bulunamadı",
      minOneRequired: "En az 1 yolcu gerekli",
      confirmRemoveTitle: "Yolcu silinsin mi?",
      confirmRemoveDesc: "Bu yolcunun bilgileri silinecek. Bu işlem geri alınamaz."
    },
    manifest: {
      title: "Yolcu Listesi",
      tour: "Tur",
      date: "Tarih",
      destination: "Destinasyon",
      vehicle: "Araç",
      guide: "Rehber",
      order: "Sıra",
      fullName: "Ad Soyad",
      identityNo: "Kimlik No",
      passportNo: "Pasaport No",
      birthDate: "Doğum Tarihi",
      isChild: "Çocuk",
      totalPassengers: "Toplam Yolcu",
      sheetName: "Yolcu Listesi",
      generatedAt: "Oluşturulma",
      noPassengers: "Yolcu bulunamadı",
      exportError: "Çıktı oluşturulamadı"
    }
  },
  en: {
    passengers: {
      title: "Passenger List",
      description: "Enter each passenger's information. Empty fields remain as placeholders.",
      fullName: "Full Name",
      identityNo: "ID Number",
      passportNo: "Passport No.",
      birthDate: "Date of Birth",
      isChild: "Child",
      addPassenger: "Add Passenger",
      removePassenger: "Remove Passenger",
      save: "Save",
      saved: "Passengers saved",
      added: "Passenger added",
      removed: "Passenger removed",
      error: "Failed to save passenger",
      empty: "No passengers found",
      minOneRequired: "At least 1 passenger required",
      confirmRemoveTitle: "Remove passenger?",
      confirmRemoveDesc: "This passenger's information will be deleted. This cannot be undone."
    },
    manifest: {
      title: "Passenger Manifest",
      tour: "Tour",
      date: "Date",
      destination: "Destination",
      vehicle: "Vehicle",
      guide: "Guide",
      order: "No.",
      fullName: "Full Name",
      identityNo: "ID Number",
      passportNo: "Passport No.",
      birthDate: "Date of Birth",
      isChild: "Child",
      totalPassengers: "Total Passengers",
      sheetName: "Passenger Manifest",
      generatedAt: "Generated",
      noPassengers: "No passengers found",
      exportError: "Could not generate output"
    }
  },
  de: {
    passengers: {
      title: "Passagierliste",
      description: "Geben Sie die Informationen jedes Passagiers ein. Leer gelassene Felder bleiben als Platzhalter.",
      fullName: "Vollständiger Name",
      identityNo: "Personalausweis-Nr.",
      passportNo: "Reisepass-Nr.",
      birthDate: "Geburtsdatum",
      isChild: "Kind",
      addPassenger: "Passagier hinzufügen",
      removePassenger: "Passagier entfernen",
      save: "Speichern",
      saved: "Passagiere gespeichert",
      added: "Passagier hinzugefügt",
      removed: "Passagier entfernt",
      error: "Speichern fehlgeschlagen",
      empty: "Keine Passagiere gefunden",
      minOneRequired: "Mindestens 1 Passagier erforderlich",
      confirmRemoveTitle: "Passagier entfernen?",
      confirmRemoveDesc: "Die Daten dieses Passagiers werden gelöscht. Dies kann nicht rückgängig gemacht werden."
    },
    manifest: {
      title: "Passagierliste",
      tour: "Tour",
      date: "Datum",
      destination: "Ziel",
      vehicle: "Fahrzeug",
      guide: "Reiseleiter",
      order: "Nr.",
      fullName: "Vollständiger Name",
      identityNo: "Personalausweis-Nr.",
      passportNo: "Reisepass-Nr.",
      birthDate: "Geburtsdatum",
      isChild: "Kind",
      totalPassengers: "Gesamtpassagiere",
      sheetName: "Passagierliste",
      generatedAt: "Erstellt",
      noPassengers: "Keine Passagiere gefunden",
      exportError: "Ausgabe konnte nicht erstellt werden"
    }
  },
  fr: {
    passengers: {
      title: "Liste des passagers",
      description: "Saisissez les informations de chaque passager. Les champs vides restent comme espaces réservés.",
      fullName: "Nom complet",
      identityNo: "N° d'identité",
      passportNo: "N° de passeport",
      birthDate: "Date de naissance",
      isChild: "Enfant",
      addPassenger: "Ajouter un passager",
      removePassenger: "Supprimer le passager",
      save: "Enregistrer",
      saved: "Passagers enregistrés",
      added: "Passager ajouté",
      removed: "Passager supprimé",
      error: "Échec de l'enregistrement",
      empty: "Aucun passager trouvé",
      minOneRequired: "Au moins 1 passager requis",
      confirmRemoveTitle: "Supprimer le passager ?",
      confirmRemoveDesc: "Les informations de ce passager seront supprimées. Cette action est irréversible."
    },
    manifest: {
      title: "Liste des passagers",
      tour: "Circuit",
      date: "Date",
      destination: "Destination",
      vehicle: "Véhicule",
      guide: "Guide",
      order: "N°",
      fullName: "Nom complet",
      identityNo: "N° d'identité",
      passportNo: "N° de passeport",
      birthDate: "Date de naissance",
      isChild: "Enfant",
      totalPassengers: "Total des passagers",
      sheetName: "Liste des passagers",
      generatedAt: "Généré le",
      noPassengers: "Aucun passager trouvé",
      exportError: "Impossible de générer la sortie"
    }
  },
  es: {
    passengers: {
      title: "Lista de pasajeros",
      description: "Introduzca la información de cada pasajero. Los campos vacíos quedan como marcadores.",
      fullName: "Nombre completo",
      identityNo: "N° de identidad",
      passportNo: "N° de pasaporte",
      birthDate: "Fecha de nacimiento",
      isChild: "Niño",
      addPassenger: "Añadir pasajero",
      removePassenger: "Eliminar pasajero",
      save: "Guardar",
      saved: "Pasajeros guardados",
      added: "Pasajero añadido",
      removed: "Pasajero eliminado",
      error: "No se pudo guardar el pasajero",
      empty: "No se encontraron pasajeros",
      minOneRequired: "Se requiere al menos 1 pasajero",
      confirmRemoveTitle: "¿Eliminar pasajero?",
      confirmRemoveDesc: "La información de este pasajero se eliminará. Esto no se puede deshacer."
    },
    manifest: {
      title: "Lista de pasajeros",
      tour: "Tour",
      date: "Fecha",
      destination: "Destino",
      vehicle: "Vehículo",
      guide: "Guía",
      order: "N°",
      fullName: "Nombre completo",
      identityNo: "N° de identidad",
      passportNo: "N° de pasaporte",
      birthDate: "Fecha de nacimiento",
      isChild: "Niño",
      totalPassengers: "Total de pasajeros",
      sheetName: "Lista de pasajeros",
      generatedAt: "Generado",
      noPassengers: "No se encontraron pasajeros",
      exportError: "No se pudo generar la salida"
    }
  },
  ru: {
    passengers: {
      title: "Список пассажиров",
      description: "Введите данные каждого пассажира. Пустые поля остаются как заполнители.",
      fullName: "Полное имя",
      identityNo: "№ удостоверения",
      passportNo: "№ паспорта",
      birthDate: "Дата рождения",
      isChild: "Ребёнок",
      addPassenger: "Добавить пассажира",
      removePassenger: "Удалить пассажира",
      save: "Сохранить",
      saved: "Пассажиры сохранены",
      added: "Пассажир добавлен",
      removed: "Пассажир удалён",
      error: "Не удалось сохранить пассажира",
      empty: "Пассажиры не найдены",
      minOneRequired: "Требуется минимум 1 пассажир",
      confirmRemoveTitle: "Удалить пассажира?",
      confirmRemoveDesc: "Данные этого пассажира будут удалены. Это действие необратимо."
    },
    manifest: {
      title: "Список пассажиров",
      tour: "Тур",
      date: "Дата",
      destination: "Направление",
      vehicle: "Транспорт",
      guide: "Гид",
      order: "№",
      fullName: "Полное имя",
      identityNo: "№ удостоверения",
      passportNo: "№ паспорта",
      birthDate: "Дата рождения",
      isChild: "Ребёнок",
      totalPassengers: "Всего пассажиров",
      sheetName: "Список пассажиров",
      generatedAt: "Создано",
      noPassengers: "Пассажиры не найдены",
      exportError: "Не удалось создать файл"
    }
  },
  ar: {
    passengers: {
      title: "قائمة المسافرين",
      description: "أدخل معلومات كل مسافر. الحقول الفارغة تبقى كمحتجزات.",
      fullName: "الاسم الكامل",
      identityNo: "رقم الهوية",
      passportNo: "رقم جواز السفر",
      birthDate: "تاريخ الميلاد",
      isChild: "طفل",
      addPassenger: "إضافة مسافر",
      removePassenger: "حذف المسافر",
      save: "حفظ",
      saved: "تم حفظ المسافرين",
      added: "تمت إضافة المسافر",
      removed: "تم حذف المسافر",
      error: "فشل حفظ المسافر",
      empty: "لا توجد مسافرون",
      minOneRequired: "مطلوب مسافر واحد على الأقل",
      confirmRemoveTitle: "حذف المسافر؟",
      confirmRemoveDesc: "سيتم حذف معلومات هذا المسافر. لا يمكن التراجع عن هذا الإجراء."
    },
    manifest: {
      title: "قائمة المسافرين",
      tour: "الجولة",
      date: "التاريخ",
      destination: "الوجهة",
      vehicle: "المركبة",
      guide: "المرشد",
      order: "الرقم",
      fullName: "الاسم الكامل",
      identityNo: "رقم الهوية",
      passportNo: "رقم جواز السفر",
      birthDate: "تاريخ الميلاد",
      isChild: "طفل",
      totalPassengers: "إجمالي المسافرين",
      sheetName: "قائمة المسافرين",
      generatedAt: "تم الإنشاء",
      noPassengers: "لا توجد مسافرون",
      exportError: "تعذر إنشاء الملف"
    }
  }
};

// admin.registrations'a sadece editPassengers anahtarını ekleyeceğiz (mevcut viewList/viewByTour vb.
// Faz 1'de zaten kondu)
const ADMIN_REGISTRATIONS_ADD = {
  tr: { editPassengers: "Yolcuları Düzenle" },
  en: { editPassengers: "Edit Passengers" },
  de: { editPassengers: "Passagiere bearbeiten" },
  fr: { editPassengers: "Modifier les passagers" },
  es: { editPassengers: "Editar pasajeros" },
  ru: { editPassengers: "Редактировать пассажиров" },
  ar: { editPassengers: "تعديل المسافرين" }
};

function inject(lang) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);

  if (!obj.admin || typeof obj.admin !== "object") obj.admin = {};

  // admin.passengers
  const passengers = TRANSLATIONS[lang].passengers;
  if (!obj.admin.passengers || typeof obj.admin.passengers !== "object") obj.admin.passengers = {};
  for (const k of Object.keys(passengers)) {
    if (!obj.admin.passengers[k]) obj.admin.passengers[k] = passengers[k];
  }

  // admin.manifest
  const manifest = TRANSLATIONS[lang].manifest;
  if (!obj.admin.manifest || typeof obj.admin.manifest !== "object") obj.admin.manifest = {};
  for (const k of Object.keys(manifest)) {
    if (!obj.admin.manifest[k]) obj.admin.manifest[k] = manifest[k];
  }

  // admin.registrations.editPassengers (sadece bu anahtar)
  if (!obj.admin.registrations || typeof obj.admin.registrations !== "object") obj.admin.registrations = {};
  if (!obj.admin.registrations.editPassengers) {
    obj.admin.registrations.editPassengers = ADMIN_REGISTRATIONS_ADD[lang].editPassengers;
  }

  const out = (hasBom ? "﻿" : "") + JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`[${lang}] passengers + manifest + editPassengers injected`);
}

for (const lang of Object.keys(TRANSLATIONS)) {
  try { inject(lang); }
  catch (e) { console.error(`[${lang}] FAILED:`, e.message); process.exitCode = 1; }
}
