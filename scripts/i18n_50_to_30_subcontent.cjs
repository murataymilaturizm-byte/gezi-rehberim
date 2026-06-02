// i18n locales subcontent (faq + cozumler bullets) — "50 tour" → "30 tour"
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "src", "i18n", "locales");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));

const pairs = [
  ["50 tours", "30 tours"],
  ["50 tura", "30 tura"],
  ["50 Touren", "30 Touren"],
  ["50 туров", "30 туров"],
  ["50 جولة", "30 جولة"],
  ["50 circuits", "30 circuits"],
  ["50 tour", "30 tour"], // ES "50 tours" da yakalanır ama yine de "50 tour" var
];

let total = 0;
for (const fn of files) {
  const fp = path.join(dir, fn);
  let c = fs.readFileSync(fp, "utf8");
  const before = c;
  for (const [from, to] of pairs) {
    const n = c.split(from).length - 1;
    if (n > 0) {
      c = c.split(from).join(to);
      console.log(`  ${fn} : ${n}x  "${from}" → "${to}"`);
      total += n;
    }
  }
  if (c !== before) fs.writeFileSync(fp, c, "utf8");
}
console.log(`\nTotal i18n subcontent changes: ${total}`);
