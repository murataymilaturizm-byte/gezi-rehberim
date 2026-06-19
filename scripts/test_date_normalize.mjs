// "aralık" regex eşleşmesi neden çalışmıyor?
const TEXT_MONTHS = {
  ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
  temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
};
const _monthPattern = Object.keys(TEXT_MONTHS).join("|");
console.log("Pattern:", _monthPattern);
console.log("Pattern length:", _monthPattern.length);

const TEXT_MONTH_REGEX = new RegExp(`(\\d{1,2})[.\\s]+(${_monthPattern})(?:[.\\s]+(\\d{4}))?`, "i");
console.log("Regex:", TEXT_MONTH_REGEX);

const inputs = ["14 aralık", "14 aralık olur", "14 aralik", "14 ARALIK", "14 ARALIK OLUR"];
for (const m of inputs) {
  const cleaned = m.toLowerCase().trim();
  const match = cleaned.match(TEXT_MONTH_REGEX);
  console.log(`"${m}" → cleaned="${cleaned}" → match=${match ? JSON.stringify(match) : "NO"}`);
}
