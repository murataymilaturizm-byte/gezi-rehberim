// SEO-GÖRSEL: public/blog'daki GERÇEK kapak dosyalarının manifestini üretir.
// BlogCoverImage build-time'da bu listeye bakar: dosya yoksa <img> hiç basılmaz,
// SVG-kapak doğrudan prerender HTML'e girer (404 + hydration-yarışı sınıfı kapanır).
// prebuild'te çalışır; manifest repo'da commit'li durur (dev-mode tazeliği için de çalıştırılabilir).
import { readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(__root, "public", "blog");
const outDir = join(__root, "src", "generated");
const out = join(outDir, "blog-image-manifest.json");

const files = existsSync(dir)
  ? readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f))
      .sort()
      .map((f) => `/blog/${f}`)
  : [];

mkdirSync(outDir, { recursive: true });
writeFileSync(out, JSON.stringify(files, null, 2) + "\n");
console.log(`[blog-image-manifest] ${files.length} kapak dosyası → src/generated/blog-image-manifest.json`);
