import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { contractSpec, prebriefSpec } from "../src/lib/tools/tur-satis-sozlesmesi/clauses";
import { INITIAL_DATA, INCLUDED_SUGGESTIONS, EXCLUDED_SUGGESTIONS } from "../src/lib/tools/tur-satis-sozlesmesi/schema";
import { buildDocHtml } from "../src/lib/tools/docx";

const d = { ...INITIAL_DATA,
  acenteUnvan: "Işık Turizm", acenteTursab: "A-1234", acenteAdres: "Nevşehir", acenteTelefon: "0384 213 45 67",
  musteriAd: "Şule Güngör", yetiskinSayisi: "3", cocukSayisi: "1",
  turAdi: "Kapadokya Kültür Turu", guzergah: "Göreme", baslangicTarihi: "2026-09-10", bitisTarihi: "2026-09-12",
  tesisAdi: "Cave Hotel", odaTipi: "Standart", geceSayisi: "2", ulasimTuru: "Otobüs",
  dahilHizmetler: INCLUDED_SUGGESTIONS.slice(0, 4).map((l, i) => ({ id: "i" + i, label: l })),
  haricHizmetler: EXCLUDED_SUGGESTIONS.slice(0, 5).map((l, i) => ({ id: "h" + i, label: l })),
  bedelTutar: "8500", kaporaTutar: "2000", kalanVade: "15 gün önce", odemeYollari: "Havale",
  merdiven: [{ id: "m1", sure: "30 gün ve öncesi", iade: "tam iade" }, { id: "m2", sure: "0-7 gün", iade: "iade yok" }],
  devirAlternatifi: true, ekKosullar: "Ek koşul metni",
  sozlesmeTarihi: "2026-08-20", formTeslimTarihi: "2026-08-18", duzenlemeYeri: "Nevşehir",
};
const c = buildDocHtml(contractSpec(d));
const p = buildDocHtml(prebriefSpec(d));
const h = (s: string) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
const out = { sozlesme: h(c), sozlesmeUzunluk: c.length, onbilgi: h(p), onbilgiUzunluk: p.length,
  dahilSayisi: INCLUDED_SUGGESTIONS.length, haricSayisi: EXCLUDED_SUGGESTIONS.length,
  dahilIlk: INCLUDED_SUGGESTIONS[0], haricIlk: EXCLUDED_SUGGESTIONS[0] };
console.log(JSON.stringify(out, null, 2));
writeFileSync("C:/Users/LENOVO/AppData/Local/Temp/claude/C--Users-LENOVO/61f832ee-92d8-468c-b5d2-1c8523d52bd1/scratchpad/arac4-before.json", JSON.stringify(out));
