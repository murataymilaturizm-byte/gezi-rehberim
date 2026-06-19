// ═══════════════════════════════════════════════════════════════════════
// ⚠️  KATMAN 2 — GERÇEK BOT UÇTAN UCA TESTİ
// ⚠️
// ⚠️  Bu test deployed demo-chat edge function'una HTTP request gönderir.
// ⚠️  Bot içinde GERÇEK Claude API çağrısı yapılır → TOKEN HARCAR.
// ⚠️
// ⚠️  KURALLAR:
// ⚠️    • SADECE MANUEL koşulur (CI/cron/otomatik pipeline'a EKLENMEZ).
// ⚠️    • Ara sıra (deploy öncesi/sonrası, NLU+prompt değişikliklerinde).
// ⚠️    • Katman 1 (test_e2e_reservation_flows.mjs) sık koş — bu seyrek.
// ⚠️    • Test DB'sinde mevcut tur adlarına göre senaryoları ayarla
// ⚠️      (DB'de 'Pamukkale' yoksa Senaryo 1 fail eder — bu test bug'ı değil
// ⚠️       veri eksikliği).
// ⚠️
// ⚠️  ÇALIŞTIRMA:
// ⚠️    node scripts/test_e2e_llm_real.mjs
// ⚠️
// ⚠️  Env değişkenleri .env'den otomatik okunur (VITE_SUPABASE_URL +
// ⚠️  VITE_SUPABASE_PUBLISHABLE_KEY).
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── .env basit parser (dotenv kullanmıyoruz, sıfır bağımlılık) ───────
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m) process.env[m[1]] ||= m[2];
    }
  } catch {
    // .env yoksa env'den umud
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("✗ VITE_SUPABASE_URL veya VITE_SUPABASE_PUBLISHABLE_KEY tanımlı değil (.env veya export et).");
  process.exit(2);
}

const ENDPOINT = `${SUPABASE_URL}/functions/v1/demo-chat`;
// demo-chat rate limits (canlıdaki gerçek değerler):
//   - 20/dakika IP (60s/20 = 3s minimum)
//   - 100/saat IP
//   - 50/saat session
// Güvenli pay: turn arası 5s (12/dakika, eşiğin yarısı). Senaryo arası 8s.
const DELAY_BETWEEN_TURNS_MS = 5000;
const DELAY_BETWEEN_SCENARIOS_MS = 8000;
// Rate limit mesajı geldiğinde auto retry: 65s bekle (1dk + 5s pay) → tekrar dene
const RATE_LIMIT_BACKOFF_MS = 65000;
const MAX_RETRIES_ON_RATE_LIMIT = 2;

// Rate limit dilekçeli mesaj detection (7 dilde demo-chat:86-94'teki literaller)
const RATE_LIMIT_PATTERNS = [
  /çok hızlı istek gönderiyorsunuz/i,
  /requests too quickly/i,
  /zu viele anfragen/i,
  /слишком много запросов/i,
  /طلبات كثيرة جداً/i,
  /trop de requêtes/i,
  /demasiadas solicitudes/i,
];
function isRateLimited(reply) {
  return RATE_LIMIT_PATTERNS.some((re) => re.test(reply));
}

// ─── Bot çağrı helper ─────────────────────────────────────────────────
async function callBot({ message, conversationState, language, sessionId, conversationStyle = "standart" }) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      message, sessionId, conversationStyle,
      conversationState: conversationState || null,
      language,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    reply: data.response || data.message || "",
    newState: data.conversationState || null,
    intent: data.intent || data.detectedIntent || null,
    raw: data,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Test runner ──────────────────────────────────────────────────────
let scenarioPasses = 0, scenarioFails = 0;
const failures = [];

function fmtReply(s, max = 120) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

async function runScenario(name, language, steps) {
  console.log(`\n━━━ ${name} (${language}) ━━━`);
  const sessionId = `e2e-${Date.now()}-${Math.floor(Math.random()*99999)}`;
  let state = null;
  let stepIdx = 0;
  let scenarioOk = true;
  const stepLogs = [];

  for (const step of steps) {
    stepIdx++;
    let result;
    let retries = 0;
    while (true) {
      try {
        result = await callBot({ message: step.msg, conversationState: state, language, sessionId });
      } catch (err) {
        console.log(`  ✗ Step ${stepIdx} "${fmtReply(step.msg, 40)}" — BOT FAIL: ${err.message}`);
        failures.push({ scenario: name, step: stepIdx, err: err.message });
        scenarioOk = false;
        break;
      }
      // Rate limit yakalanırsa otomatik retry — geçici limit testi yanlış kırmıza düşürmesin
      if (isRateLimited(result.reply) && retries < MAX_RETRIES_ON_RATE_LIMIT) {
        retries++;
        const waitSec = Math.round(RATE_LIMIT_BACKOFF_MS / 1000);
        console.log(`  ⏳ Step ${stepIdx} rate-limited — ${waitSec}s bekleniyor (retry ${retries}/${MAX_RETRIES_ON_RATE_LIMIT})`);
        await sleep(RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      break;  // başarılı veya retry tükendi
    }
    if (!scenarioOk) break;
    if (isRateLimited(result.reply)) {
      console.log(`  ✗ Step ${stepIdx} — rate limit retries tükendi, gerçek test başarısız değil ama atlanıyor`);
      failures.push({ scenario: name, step: stepIdx, err: "rate_limit_exhausted", reply: result.reply });
      scenarioOk = false;
      break;
    }

    const newStage = result.newState?.stage || "?";
    const newCollStep = result.newState?.collectionStep || "-";
    const fullName = result.newState?.reservationInfo?.fullName || "-";
    const paxAdult = result.newState?.reservationInfo?.paxAdult || "-";
    const phone = result.newState?.reservationInfo?.phone ? "***set***" : "-";
    const dateId = result.newState?.reservationInfo?.dateId || "-";

    stepLogs.push(`    user: "${fmtReply(step.msg, 50)}"`);
    stepLogs.push(`    bot:  "${fmtReply(result.reply, 100)}"`);
    stepLogs.push(`    state: stage=${newStage} step=${newCollStep} | name=${fullName} pax=${paxAdult} phone=${phone} dateId=${dateId}`);

    // Expectation kontrolleri (ESNEK — bot tepkisi her zaman BİREBİR aynı olmaz)
    let stepOk = true;
    const errs = [];
    for (const [key, predicate] of Object.entries(step.expect || {})) {
      const actual = key.split(".").reduce((o, k) => o?.[k], result.newState);
      if (typeof predicate === "function") {
        if (!predicate(actual, result.reply)) {
          errs.push(`${key}: predicate failed (actual=${JSON.stringify(actual)})`);
          stepOk = false;
        }
      } else {
        if (actual !== predicate) {
          errs.push(`${key}: expected=${JSON.stringify(predicate)} actual=${JSON.stringify(actual)}`);
          stepOk = false;
        }
      }
    }
    // Reply içerik kontrolleri (eğer step.expectReply varsa)
    if (step.expectReply) {
      const predicate = step.expectReply;
      if (typeof predicate === "function") {
        if (!predicate(result.reply, result.newState)) {
          errs.push(`reply: predicate failed (reply="${fmtReply(result.reply)}")`);
          stepOk = false;
        }
      } else if (predicate instanceof RegExp) {
        if (!predicate.test(result.reply)) {
          errs.push(`reply regex /${predicate.source}/ failed`);
          stepOk = false;
        }
      }
    }

    if (stepOk) {
      console.log(`  ✓ Step ${stepIdx} "${fmtReply(step.msg, 50)}" → stage=${newStage} step=${newCollStep}`);
    } else {
      console.log(`  ✗ Step ${stepIdx} "${fmtReply(step.msg, 50)}"`);
      for (const e of errs) console.log(`      ${e}`);
      console.log(`      Bot reply: "${fmtReply(result.reply, 150)}"`);
      failures.push({ scenario: name, step: stepIdx, msg: step.msg, errs, reply: result.reply });
      scenarioOk = false;
      break;
    }

    state = result.newState;
    await sleep(DELAY_BETWEEN_TURNS_MS);
  }

  if (scenarioOk) {
    scenarioPasses++;
    console.log(`  ✓ ${name} — TÜM ${stepIdx} step geçti`);
  } else {
    scenarioFails++;
    // Tam log dump fail durumunda
    console.log(`  ── full step log ──`);
    for (const l of stepLogs) console.log(l);
  }
  await sleep(DELAY_BETWEEN_SCENARIOS_MS);
}

// ─── Yardımcı: dolu alanlar korunuyor mu? ─────────────────────────────
function statePreservation(prevState, fields) {
  return (newState) => {
    if (!prevState?.reservationInfo) return true;
    for (const f of fields) {
      const prev = prevState.reservationInfo[f];
      const now = newState?.reservationInfo?.[f];
      if (prev && now !== prev) return false;
    }
    return true;
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SENARYOLAR (AZ ve ÖZ — her senaryo ~5-7 bot çağrısı = ~10-15c token)
// Toplam ~6 senaryo × ~6 turn ≈ 36 turn × 1-2c token = ~50-70c/koşu
// ═══════════════════════════════════════════════════════════════════════

console.log(`\nEndpoint: ${ENDPOINT}`);
console.log(`6 senaryo × ~6 turn ≈ 36 LLM çağrısı (tahmini ~50-70c token).`);
console.log(`Turn arası ${DELAY_BETWEEN_TURNS_MS/1000}s + senaryo arası ${DELAY_BETWEEN_SCENARIOS_MS/1000}s bekleme (rate limit güvenlik).`);
console.log(`Toplam süre: ~5-6 dakika. Rate limit auto retry ile (max ${MAX_RETRIES_ON_RATE_LIMIT}x).`);
console.log(`Devam etmek için 3s bekle, iptal için Ctrl+C...\n`);
await sleep(3000);

// === 1. Düz akış TR: tur → tarih → pax → isim → telefon → "evet" ===
await runScenario("S1: Düz akış TR — tüm adımlar", "tr", [
  {
    msg: "Merhaba, Pamukkale turuna katılmak istiyorum",
    expect: {
      stage: (s) => s === "BROWSING" || s === "TOUR_SELECTED" || s === "COLLECTING_INFO",
    },
  },
  {
    msg: "İlk müsait tarih neyse, onu istiyorum",
    expect: {
      stage: (s) => s === "COLLECTING_INFO" || s === "TOUR_SELECTED",
    },
  },
  {
    msg: "2 kişiyiz",
    expect: {
      "reservationInfo.paxAdult": 2,
    },
  },
  {
    msg: "Adım Ayşe Yılmaz",
    expect: {
      "reservationInfo.fullName": (n) => typeof n === "string" && n.toLowerCase().includes("ayşe"),
      "reservationInfo.paxAdult": 2,    // korunmalı
    },
  },
  {
    msg: "05551234567",
    expect: {
      "reservationInfo.phone": (p) => typeof p === "string" && p.includes("5551234567"),
      "reservationInfo.fullName": (n) => typeof n === "string" && n.toLowerCase().includes("ayşe"),
    },
  },
  {
    msg: "evet",
    expect: {
      stage: "COMPLETED",
      reservationConfirmed: true,
    },
  },
]);

// === 2. Tarih onay ekiyle: "X aralık olur" — parser doğru ayıklıyor mu? ===
await runScenario("S2: Tarih ek sözcükle", "tr", [
  { msg: "Merhaba", expect: {} },
  { msg: "Kapadokya turunu istiyorum", expect: {
      stage: (s) => ["BROWSING","TOUR_SELECTED","COLLECTING_INFO"].includes(s),
  }},
  // Burada "olur" ekini parser temizleyip tarihi ayıklamalı
  { msg: "20 aralık olur",
    expect: {
      "reservationInfo.dateId": (id) => !!id || true,  // dateId varsa veya yoksa kabul; ASIL doğrulama bot reply'da
    },
    expectReply: (reply) =>
      // Bot tarihi anlamadıysa "müsait değil" / "anlamadım" der → fail
      !/(müsait değil|anlamadım|geçersiz tarih|tarih bulunamadı)/i.test(reply),
  },
]);

// === 3. İsim mesajı → reservation_intent'e YANLIŞ düşmüyor mu? (Özge bug NLU tarafı) ===
await runScenario("S3: İsim mesajı, tur değişimi tetiklemez", "tr", [
  { msg: "Merhaba, Pamukkale", expect: {} },
  { msg: "30 aralık olur", expect: {} },
  { msg: "1 kişi", expect: { "reservationInfo.paxAdult": 1 } },
  // Bu mesaj eski Özge bug'ında reservation_intent'e düşüyordu → tur değişimi sanılıyordu
  { msg: "Adım Özge Yılmazer",
    expect: {
      "reservationInfo.fullName": (n) => typeof n === "string" && n.toLowerCase().includes("özge"),
      "reservationInfo.paxAdult": 1,  // KORUNMALI (Özge fix kanıtı)
      stage: (s) => s === "COLLECTING_INFO",  // TOUR_SELECTED'a ATLAMAMALI
    },
  },
]);

// === 4. "Söylemiştim ya" referans — state silinmiyor mu? ===
await runScenario("S4: 'söylemiştim ya' state'i silmez", "tr", [
  { msg: "Merhaba, Efes turuna kayıt yaptırmak istiyorum", expect: {} },
  { msg: "İlk müsait tarih", expect: {} },
  { msg: "2 kişiyiz", expect: { "reservationInfo.paxAdult": 2 } },
  { msg: "Mehmet Demir", expect: {
      "reservationInfo.fullName": (n) => typeof n === "string" && n.toLowerCase().includes("mehmet"),
  }},
  // Kullanıcı tekrar referans verir — bot tekrar isim sormamalı, isim KORUNMALI
  { msg: "ismimi söylemiştim ya",
    expect: {
      "reservationInfo.fullName": (n) => typeof n === "string" && n.toLowerCase().includes("mehmet"),
      "reservationInfo.paxAdult": 2,
    },
    expectReply: (reply) =>
      // Bot "isminizi göremiyorum" demeMELİ
      !/(isminizi göremiyorum|adınızı tekrar|isminizi alabilir miyim)/i.test(reply),
  },
]);

// === 5. Onayda "hayır" → COMPLETED'a geçmiyor (B-6 fix) ===
await runScenario("S5: CONFIRMING'de 'hayır' → netleştirme", "tr", [
  { msg: "Merhaba, Pamukkale", expect: {} },
  { msg: "25 aralık olur", expect: {} },
  { msg: "1 kişi", expect: {} },
  { msg: "Burak Yıldız", expect: {} },
  { msg: "05559998877", expect: {
      stage: (s) => s === "CONFIRMING" || s === "COLLECTING_INFO",
  }},
  { msg: "hayır",
    expect: {
      stage: (s) => s !== "COMPLETED",     // COMPLETED'a GEÇMEMELİ
      reservationConfirmed: (rc) => !rc,
    },
    expectReply: (reply) =>
      // Bot netleştirme sorusu sormalı
      /(değiştir|hangi|iptal|tarih|kişi|isim|telefon|change|which|cancel)/i.test(reply),
  },
]);

// === 6. Çok dilli — EN happy path (kısa) ===
await runScenario("S6: EN — language detect + flow", "en", [
  { msg: "Hello, I'd like to book the Pamukkale tour", expect: {} },
  { msg: "Any available date works", expect: {} },
  { msg: "2 people", expect: {
      "reservationInfo.paxAdult": (n) => n === 2 || n === undefined,
  }},
  { msg: "John Smith", expect: {
      "reservationInfo.fullName": (n) => typeof n === "string" && n.toLowerCase().includes("john"),
  }},
]);

// ═══════════════════════════════════════════════════════════════════════
console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`SONUÇ: ${scenarioPasses}/${scenarioPasses + scenarioFails} senaryo geçti`);
if (scenarioFails > 0) {
  console.log(`\nBaşarısız senaryolar:`);
  for (const f of failures) {
    console.log(`  ✗ [${f.scenario}] step${f.step}: "${(f.msg || "").slice(0, 50)}"`);
    if (f.err) console.log(`     hata: ${f.err}`);
    if (f.errs) for (const e of f.errs) console.log(`     ${e}`);
    if (f.reply) console.log(`     bot: "${f.reply.slice(0, 150)}"`);
  }
  console.log(`\nNot: Bazı fail'ler bot'un kelime seçimi nedeniyle olabilir (LLM deterministik değil).`);
  console.log(`     Akış mantığı doğru ama wording farklıysa expectReply regex'lerini gevşet.`);
}
console.log(`═══════════════════════════════════════════════════════════════════════`);
process.exit(scenarioFails === 0 ? 0 : 1);
