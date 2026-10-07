#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// `npm test` — TEK KOMUT: suite (scripts/test_behavioral.ts) + Katman-2 harness
// (supabase/functions/_tests/harness/*_test.ts).
//
// KURAL (PAKET-0 Dilim-1, 2026-10-07): Deno yoksa SERT HATA (exit 2). Eski
// test_e2e_reservation_flows.mjs Deno yoksa "ATLANDI" deyip yeşil geçiyordu →
// "testler yeşil" raporu Deno'suz makinede boş olabiliyordu (denetim H1).
//
// Deno aranan yerler: PATH, ~/.deno/bin, DENO_BIN env.
// Harness --no-check ile koşar: prod kodda 4 önceden-var-olan tip hatası var
// (PromptContext.fx/agencyDescription, X8 _top.price) — Dilim-1 kapsamı dışı,
// sonuç raporunda "açık kalan" olarak listelendi.
// ═══════════════════════════════════════════════════════════════════════════
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function findDeno() {
  const exe = platform() === "win32" ? "deno.exe" : "deno";
  const candidates = [
    process.env.DENO_BIN,
    "deno",
    join(homedir(), ".deno", "bin", exe),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c !== "deno" && !existsSync(c)) continue;
    const probe = spawnSync(c, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) return c;
  }
  return null;
}

const deno = findDeno();
if (!deno) {
  console.error("\n✖ SERT HATA: Deno bulunamadı (PATH, ~/.deno/bin, DENO_BIN).");
  console.error("  Testler ATLANMADI — KOŞULMADI. Kurulum: https://deno.land  (irm https://deno.land/install.ps1 | iex)");
  console.error("  Deno'suz 'yeşil' rapor yok; bu çıkış kodu (2) kasıtlıdır.\n");
  process.exit(2);
}
console.log(`▶ deno: ${deno}`);

function run(label, args) {
  console.log(`\n━━━ ${label} ━━━`);
  const r = spawnSync(deno, args, { cwd: root, stdio: "inherit" });
  return r.status ?? 1;
}

const s1 = run("Katman-1 suite: scripts/test_behavioral.ts",
  ["run", "--allow-read", "--allow-env", "--allow-run", "scripts/test_behavioral.ts"]);
const s2 = run("Katman-2 harness: supabase/functions/_tests/harness",
  ["test", "--no-check", "--allow-read", "--allow-env", "--allow-net", "--allow-write",
   "--import-map=supabase/functions/_tests/harness/import_map.json", "supabase/functions/_tests/harness/"]);

console.log(`\n━━━ SONUÇ ━━━  suite=${s1 === 0 ? "✓" : "✗ (" + s1 + ")"}  harness=${s2 === 0 ? "✓" : "✗ (" + s2 + ")"}`);
process.exit(s1 === 0 && s2 === 0 ? 0 : 1);
