// HTTP 410 Gone — kapatılmış eski WordPress bölümleri için.
//
// NEDEN FONKSİYON: Vercel'in vercel.json'ı 3xx dışında statü döndüremiyor
// (redirects yalnız 301/302/307/308, headers statü değiştirmez). 410 için
// çalışma-zamanı gerekiyor.
//
// NEDEN 410, "/" YE 301 DEĞİL: eski turzz.com WordPress bölümleri (/tur/,
// /tour-tag/, /kalkis-noktasi/, tarih arşivleri …) artık HİÇBİR YERDE yok.
// Ölçüm (2026-09-18): turzz.com tüm path'leri — uydurma olanlar dahil —
// turzzai.com'a 308 ile geri atıyor; eski içerik sunulmuyor. Bu yüzden
// "turzz.com'a geri 301" SONSUZ DÖNGÜ olurdu. Alakasız bir hedefe (ana sayfa)
// 301 ise Google tarafından soft-404 sayılıyor — GSC'deki tablo bunu gösterdi.
// 410 "bu kaynak kalıcı olarak kaldırıldı" der; indeksten en hızlı düşüş yolu.
export default function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(410).send(`<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sayfa kaldırıldı | Turzz AI</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;color:#1c1917;
       display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
  .k{max-width:520px;text-align:center}
  h1{font-size:1.5rem;margin:0 0 12px}
  p{color:#57534e;line-height:1.6;margin:0 0 20px}
  a{display:inline-block;background:#f57928;color:#fff;text-decoration:none;
    padding:10px 20px;border-radius:8px;font-weight:600}
</style>
</head>
<body>
  <div class="k">
    <h1>Bu sayfa kaldırıldı</h1>
    <p>Aradığınız sayfa eski Turzz tur portalına aitti ve yayından kaldırıldı.
       Turzz AI artık seyahat acenteleri için WhatsApp rezervasyon asistanı sunuyor.</p>
    <a href="/">Ana sayfaya git</a>
  </div>
</body>
</html>`);
}
