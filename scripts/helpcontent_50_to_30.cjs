// helpContent.ts içinde "Up to 50 tours" → "Up to 30 tours" gibi 7 dil çevirilerini güncelle
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "src", "data", "helpContent.ts");
let c = fs.readFileSync(file, "utf8");

const pairs = [
  ["50 tura kadar", "30 tura kadar"],
  ["Up to 50 tours", "Up to 30 tours"],
  ["bis zu 50 Touren", "bis zu 30 Touren"],
  ["Bis zu 50 Touren", "Bis zu 30 Touren"],
  ["до 50 туров", "до 30 туров"],
  ["حتى 50 جولة", "حتى 30 جولة"],
  ["jusqu'à 50 circuits", "jusqu'à 30 circuits"],
  ["Jusqu'à 50 circuits", "Jusqu'à 30 circuits"],
  ["hasta 50 tours", "hasta 30 tours"],
  ["Hasta 50 tours", "Hasta 30 tours"],
];

let total = 0;
for (const [from, to] of pairs) {
  const parts = c.split(from);
  const n = parts.length - 1;
  if (n > 0) {
    c = parts.join(to);
    console.log(`  ${n}x  "${from}"  →  "${to}"`);
    total += n;
  }
}
fs.writeFileSync(file, c, "utf8");
console.log(`\nTotal helpContent changes: ${total}`);
