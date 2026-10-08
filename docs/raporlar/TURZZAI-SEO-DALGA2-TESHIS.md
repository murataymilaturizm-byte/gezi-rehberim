# turzzai.com — SEO Dalga 2 Teşhisi (çok dilli dizinleme)

**Tarih:** 2026-10-08 · **Tür:** salt teşhis (kod değişikliği, commit, deploy YOK) · **Yöntem:** canlı `sitemap.xml` (148 URL) Googlebot UA ile tek tek indirildi, HTML diske yazılıp ayrıştırıldı (head sinyalleri, `<article>` gövdesi, `<a href>` grafiği); kaynak kod okundu.
**Dalga 1 bağlamı:** `02f0981` (2026-09-18): soft-404, 410, canonical. Kapsam dışı bırakılanlar: `<html lang>` sabit, blog index'te hreflang yok, dil seçici JS-only, yabancı sayfada menü/footer TR.
**Doğrulanmadı:** Search Console verisine erişim yok; "keşfedildi, dizine eklenmedi" sayıları ve hangi URL'lerin dizinde olduğu ölçülmedi. Çevirilerin anadil akıcılığı değerlendirilmedi; yalnız dilin doğruluğu ve TR'den kopya olmadığı ölçüldü.

---

## Özet bulgu tablosu

| # | Bulgu | Etki | Kanıt |
|---|---|---|---|
| B1 | Yabancı dildeki **82 sayfanın 82'si** `<html lang="tr">`, `og:locale=tr_TR` | Google sayfanın dilini TR sinyaliyle görüyor; hreflang ile çelişki | §1, `SEOHead.tsx:67,71` + `i18n/index.ts:24-26` |
| B2 | Yabancı sayfalarda **menü, footer, CTA, dil seçici etiketi, kategori, "Paylaş", global JSON-LD açıklaması TR** | Sayfa "karışık dil"; gövde dışı metnin tamamı TR | §4 |
| B3 | Yabancı dil klasörlerine **başka hiçbir dilden `<a href>` yok** (TR→yabancı: 0); yabancı **blog index'leri yetim** (0 gelen link) | Yabancı kümeler yalnız sitemap + hreflang ile keşfedilebilir adalar → "keşfedildi, dizine eklenmedi" ile uyumlu (nedensellik doğrulanmadı) | §3 |
| B4 | Blog **gövdeleri gerçekten çevrilmiş** (96/96 doğru dilde, TR ile 3-gram örtüşme ort. %0.5–0.8) | Olumlu: içerik kalitesi dizinlemenin engeli değil | §2 |
| B5 | Yabancı URL'lerin **tamamı TR slug** (30 slug, 96 URL); kategori ("Acente Rehberi") ve okuma süresi ("9 dk") TR | URL ve kart etiketlerinde dil karışıklığı | §2 |
| B6 | Yabancı blog index'leri (`/en/blog` …) **TR title + TR description**, hreflang yok; 5 index aynı başlıkta | Yinelenen başlık; index sayfaları birbirine bağlı değil | §1 |
| B7 | Ana sayfa + 4 landing + araçlar + yasal sayfalar **yalnız TR URL**; dil değişimi yalnız istemcide metin değiştiriyor. `/en/tools`, `/de/tools` (12 rota) var ama **noindex SPA kabuğu** | Yabancı dilde giriş noktası (home/landing) yok | §1, §5 |
| B8 | Sitemap'te alternate'ler yalnız blog yazılarında (126 URL, 684 `xhtml:link`); statik/index'te yok. 22 URL'nin `lastmod`'u build günü | Statik sayfalarda lastmod güvenilmez sinyal | §5 |

Doğru çalışan (değişiklik gerekmez): 148/148 HTTP 200; 148/148 canonical kendisi; blog yazılarında head hreflang ↔ sitemap alternate **126/126 birebir**, x-default (EN varsa EN) her yazıda var; yazıya özel `Article`+`FAQPage` JSON-LD o dilde ve `inLanguage` doğru; ru/ar blog index'leri noindex (Dalga 1).

---

## 1) Dil sayfası envanteri

### Dil × tür sayımı (canlı, 148 URL)

| Dil | Tür | Sayfa | HTTP 200 | canonical=kendisi | noindex | `<html lang>` doğru | head hreflang'lı | sitemap alternate'li |
|---|---|---|---|---|---|---|---|---|
| tr | statik | 11 | 11 | 11 | 0 | 11 | 0 | 0 |
| tr | araç | 6 | 6 | 6 | 0 | 6 | 0 | 0 |
| tr | blog-index | 1 | 1 | 1 | 0 | 1 | 0 | 0 |
| tr | blog | 30 | 30 | 30 | 0 | 30 | 30 | 30 |
| en | blog-index | 1 | 1 | 1 | 0 | **0** | 0 | 0 |
| en | blog | 30 | 30 | 30 | 0 | **0** | 30 | 30 |
| de | blog-index | 1 | 1 | 1 | 0 | **0** | 0 | 0 |
| de | blog | 30 | 30 | 30 | 0 | **0** | 30 | 30 |
| fr | blog-index | 1 | 1 | 1 | 0 | **0** | 0 | 0 |
| fr | blog | 18 | 18 | 18 | 0 | **0** | 18 | 18 |
| es | blog-index | 1 | 1 | 1 | 0 | **0** | 0 | 0 |
| es | blog | 18 | 18 | 18 | 0 | **0** | 18 | 18 |
| **Toplam** | | **148** | 148 | 148 | 0 | 66 | 126 | 126 |

**Dil bazında:** tr 48 · en 31 · de 31 · fr 19 · es 19 · ru 0 · ar 0. Kaynak dosyalar: `src/blog/posts/{tr,en,de}` 30'ar, `{fr,es}` 18'er, `{ru,ar}` 0.

**Sitemap dışı ama canlı:** `/ru/blog`, `/ar/blog` (200, `noindex, nofollow`, SPA kabuğu; dil seçici oraya götürüyor). `/en/tools` + 5 alt, `/de/tools` + 5 alt (200, `noindex, nofollow`, SPA kabuğu; `src/routes.tsx:119-130` rotaları var, prerender yok: `vercel.json:124-139`).

Canlı kesit:
```
$ curl -s https://turzzai.com/de/blog/gunubirlik-tur-operatoru-rehberi | grep -o '<html[^>]*>\|<link[^>]*hreflang[^>]*>'
<html lang="tr" dir="ltr">
<link data-rh="true" rel="alternate" hreflang="tr" href="https://turzzai.com/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="en" href="https://turzzai.com/en/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="de" href="https://turzzai.com/de/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="x-default" href="https://turzzai.com/en/blog/gunubirlik-tur-operatoru-rehberi">
$ curl -s https://turzzai.com/en/blog | grep -o '<html[^>]*>\|<title>[^<]*'
<html lang="tr" dir="ltr">
<title>Blog — WhatsApp Chatbot ve Turizm Teknolojisi Rehberleri | Turzz AI
$ for p in /ru/blog /ar/blog /en/tools /de/tools; do …; done
/ru/blog 200 <meta name="robots" content="noindex, nofollow">   (/ar/blog, /en/tools, /de/tools aynı)
```

Yabancı blog yazılarında `title`/`description` **o dilde** (ör. de: "Leitfaden für Tagestour-Veranstalter: …"). Yabancı **blog index'lerinde** ise TR ("Blog — WhatsApp Chatbot ve Turizm Teknolojisi Rehberleri"): `src/pages/Blog.tsx:269-277` sabit TR string, `extraLinks` (hreflang) verilmiyor.

### Tam envanter (148 URL)
Sütunlar: TR karşılığı = aynı yazının TR URL'si; `<html lang>` ✗ = URL diliyle uyuşmuyor; hreflang = sayfa head'indeki / sitemap'teki alternate sayısı (x-default dahil); gelen iç link = bu sayfaya `<a href>` veren farklı prerender sayfası sayısı.

| # | URL | Dil | Tür | TR karşılığı | HTTP | canonical | robots | `<html lang>` | hreflang head/sitemap | gelen iç link |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 147 |
| 2 | `/whatsapp-chatbot-seyahat-acentesi` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 141 |
| 3 | `/ai-tur-rezervasyonu` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 141 |
| 4 | `/cok-dilli-musteri-hizmetleri` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 141 |
| 5 | `/tur-otomasyonu` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 141 |
| 6 | `/araclar` | tr | araç | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 147 |
| 7 | `/araclar/rehber-sozlesmesi-olusturucu` | tr | araç | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 1 |
| 8 | `/araclar/tur-kar-hesaplayici` | tr | araç | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 3 |
| 9 | `/araclar/tur-satis-sozlesmesi-olusturucu` | tr | araç | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 2 |
| 10 | `/araclar/tur-teklifi-olusturucu` | tr | araç | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 1 |
| 11 | `/araclar/transfer-sozlesmesi-olusturucu` | tr | araç | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 2 |
| 12 | `/nasil-baslarim` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 142 |
| 13 | `/yardim` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 142 |
| 14 | `/privacy-policy` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 142 |
| 15 | `/terms-of-service` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 142 |
| 16 | `/data-deletion` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 143 |
| 17 | `/data-export` | tr | statik | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 143 |
| 18 | `/blog` | tr | blog-index | — | 200 | kendisi | meta yok (index) | tr | 0/0 | 147 |
| 19 | `/en/blog` | en | blog-index | `/blog` | 200 | kendisi | meta yok (index) | tr ✗ | 0/0 | 0 |
| 20 | `/de/blog` | de | blog-index | `/blog` | 200 | kendisi | meta yok (index) | tr ✗ | 0/0 | 0 |
| 21 | `/fr/blog` | fr | blog-index | `/blog` | 200 | kendisi | meta yok (index) | tr ✗ | 0/0 | 0 |
| 22 | `/es/blog` | es | blog-index | `/blog` | 200 | kendisi | meta yok (index) | tr ✗ | 0/0 | 0 |
| 23 | `/blog/gunubirlik-tur-operatoru-rehberi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 31 |
| 24 | `/en/blog/gunubirlik-tur-operatoru-rehberi` | en | blog | `/blog/gunubirlik-tur-operatoru-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 30 |
| 25 | `/de/blog/gunubirlik-tur-operatoru-rehberi` | de | blog | `/blog/gunubirlik-tur-operatoru-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 30 |
| 26 | `/blog/incoming-acente-rehberi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 31 |
| 27 | `/en/blog/incoming-acente-rehberi` | en | blog | `/blog/incoming-acente-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 30 |
| 28 | `/de/blog/incoming-acente-rehberi` | de | blog | `/blog/incoming-acente-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 30 |
| 29 | `/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 33 |
| 30 | `/en/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | en | blog | `/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 29 |
| 31 | `/de/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | de | blog | `/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 29 |
| 32 | `/blog/yabanci-turiste-tur-satisi-cok-dilli-iletisim` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 14 |
| 33 | `/en/blog/yabanci-turiste-tur-satisi-cok-dilli-iletisim` | en | blog | `/blog/yabanci-turiste-tur-satisi-cok-dilli-iletisim` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 14 |
| 34 | `/de/blog/yabanci-turiste-tur-satisi-cok-dilli-iletisim` | de | blog | `/blog/yabanci-turiste-tur-satisi-cok-dilli-iletisim` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 14 |
| 35 | `/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 6 |
| 36 | `/en/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir` | en | blog | `/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 3 |
| 37 | `/de/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir` | de | blog | `/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 3 |
| 38 | `/blog/whatsappta-musteri-neden-cevapsiz-birakir` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 13 |
| 39 | `/en/blog/whatsappta-musteri-neden-cevapsiz-birakir` | en | blog | `/blog/whatsappta-musteri-neden-cevapsiz-birakir` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 13 |
| 40 | `/de/blog/whatsappta-musteri-neden-cevapsiz-birakir` | de | blog | `/blog/whatsappta-musteri-neden-cevapsiz-birakir` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 13 |
| 41 | `/blog/acenteler-icin-meta-reklam-rehberi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 8 |
| 42 | `/en/blog/acenteler-icin-meta-reklam-rehberi` | en | blog | `/blog/acenteler-icin-meta-reklam-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 8 |
| 43 | `/de/blog/acenteler-icin-meta-reklam-rehberi` | de | blog | `/blog/acenteler-icin-meta-reklam-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 8 |
| 44 | `/blog/internetten-tur-satisi-nasil-yapilir` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 7 |
| 45 | `/en/blog/internetten-tur-satisi-nasil-yapilir` | en | blog | `/blog/internetten-tur-satisi-nasil-yapilir` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 7 |
| 46 | `/de/blog/internetten-tur-satisi-nasil-yapilir` | de | blog | `/blog/internetten-tur-satisi-nasil-yapilir` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 7 |
| 47 | `/blog/acente-acarken-yapilan-10-hata` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 6 |
| 48 | `/en/blog/acente-acarken-yapilan-10-hata` | en | blog | `/blog/acente-acarken-yapilan-10-hata` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 4 |
| 49 | `/de/blog/acente-acarken-yapilan-10-hata` | de | blog | `/blog/acente-acarken-yapilan-10-hata` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 4 |
| 50 | `/blog/web-chatbot-mu-whatsapp-rezervasyon-asistani-mi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 13 |
| 51 | `/en/blog/web-chatbot-mu-whatsapp-rezervasyon-asistani-mi` | en | blog | `/blog/web-chatbot-mu-whatsapp-rezervasyon-asistani-mi` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 13 |
| 52 | `/de/blog/web-chatbot-mu-whatsapp-rezervasyon-asistani-mi` | de | blog | `/blog/web-chatbot-mu-whatsapp-rezervasyon-asistani-mi` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 13 |
| 53 | `/blog/acenteler-icin-whatsapp-business-kurulumu` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 14 |
| 54 | `/en/blog/acenteler-icin-whatsapp-business-kurulumu` | en | blog | `/blog/acenteler-icin-whatsapp-business-kurulumu` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 14 |
| 55 | `/de/blog/acenteler-icin-whatsapp-business-kurulumu` | de | blog | `/blog/acenteler-icin-whatsapp-business-kurulumu` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 14 |
| 56 | `/blog/seyahat-acentesi-nasil-acilir` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 4/4 | 7 |
| 57 | `/en/blog/seyahat-acentesi-nasil-acilir` | en | blog | `/blog/seyahat-acentesi-nasil-acilir` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 5 |
| 58 | `/de/blog/seyahat-acentesi-nasil-acilir` | de | blog | `/blog/seyahat-acentesi-nasil-acilir` | 200 | kendisi | meta yok (index) | tr ✗ | 4/4 | 5 |
| 59 | `/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 60 | `/en/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | en | blog | `/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 61 | `/de/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | de | blog | `/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 62 | `/fr/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | fr | blog | `/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 18 |
| 63 | `/es/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | es | blog | `/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 18 |
| 64 | `/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 65 | `/en/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | en | blog | `/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 66 | `/de/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | de | blog | `/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 67 | `/fr/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | fr | blog | `/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 15 |
| 68 | `/es/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | es | blog | `/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 15 |
| 69 | `/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 2 |
| 70 | `/en/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | en | blog | `/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 71 | `/de/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | de | blog | `/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 72 | `/fr/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | fr | blog | `/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 13 |
| 73 | `/es/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | es | blog | `/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 13 |
| 74 | `/blog/whatsapp-business-api-acente-rehberi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 75 | `/en/blog/whatsapp-business-api-acente-rehberi` | en | blog | `/blog/whatsapp-business-api-acente-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 76 | `/de/blog/whatsapp-business-api-acente-rehberi` | de | blog | `/blog/whatsapp-business-api-acente-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 77 | `/fr/blog/whatsapp-business-api-acente-rehberi` | fr | blog | `/blog/whatsapp-business-api-acente-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 4 |
| 78 | `/es/blog/whatsapp-business-api-acente-rehberi` | es | blog | `/blog/whatsapp-business-api-acente-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 4 |
| 79 | `/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 2 |
| 80 | `/en/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | en | blog | `/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 81 | `/de/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | de | blog | `/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 82 | `/fr/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | fr | blog | `/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 83 | `/es/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | es | blog | `/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 84 | `/blog/whatsapp-chatbot-tur-satis-rehberi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 85 | `/en/blog/whatsapp-chatbot-tur-satis-rehberi` | en | blog | `/blog/whatsapp-chatbot-tur-satis-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 86 | `/de/blog/whatsapp-chatbot-tur-satis-rehberi` | de | blog | `/blog/whatsapp-chatbot-tur-satis-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 87 | `/fr/blog/whatsapp-chatbot-tur-satis-rehberi` | fr | blog | `/blog/whatsapp-chatbot-tur-satis-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 88 | `/es/blog/whatsapp-chatbot-tur-satis-rehberi` | es | blog | `/blog/whatsapp-chatbot-tur-satis-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 89 | `/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 140 |
| 90 | `/en/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | en | blog | `/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 91 | `/de/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | de | blog | `/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 92 | `/fr/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | fr | blog | `/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 93 | `/es/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | es | blog | `/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 94 | `/blog/seyahat-acentesi-dijital-donusum-adimlari` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 95 | `/en/blog/seyahat-acentesi-dijital-donusum-adimlari` | en | blog | `/blog/seyahat-acentesi-dijital-donusum-adimlari` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 96 | `/de/blog/seyahat-acentesi-dijital-donusum-adimlari` | de | blog | `/blog/seyahat-acentesi-dijital-donusum-adimlari` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 97 | `/fr/blog/seyahat-acentesi-dijital-donusum-adimlari` | fr | blog | `/blog/seyahat-acentesi-dijital-donusum-adimlari` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 98 | `/es/blog/seyahat-acentesi-dijital-donusum-adimlari` | es | blog | `/blog/seyahat-acentesi-dijital-donusum-adimlari` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 99 | `/blog/turkiye-turizm-sektoru-2026-trendleri` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 100 | `/en/blog/turkiye-turizm-sektoru-2026-trendleri` | en | blog | `/blog/turkiye-turizm-sektoru-2026-trendleri` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 101 | `/de/blog/turkiye-turizm-sektoru-2026-trendleri` | de | blog | `/blog/turkiye-turizm-sektoru-2026-trendleri` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 102 | `/fr/blog/turkiye-turizm-sektoru-2026-trendleri` | fr | blog | `/blog/turkiye-turizm-sektoru-2026-trendleri` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 103 | `/es/blog/turkiye-turizm-sektoru-2026-trendleri` | es | blog | `/blog/turkiye-turizm-sektoru-2026-trendleri` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 104 | `/blog/musteri-sadakat-programi-tur-operatoru` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 2 |
| 105 | `/en/blog/musteri-sadakat-programi-tur-operatoru` | en | blog | `/blog/musteri-sadakat-programi-tur-operatoru` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 106 | `/de/blog/musteri-sadakat-programi-tur-operatoru` | de | blog | `/blog/musteri-sadakat-programi-tur-operatoru` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 107 | `/fr/blog/musteri-sadakat-programi-tur-operatoru` | fr | blog | `/blog/musteri-sadakat-programi-tur-operatoru` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 108 | `/es/blog/musteri-sadakat-programi-tur-operatoru` | es | blog | `/blog/musteri-sadakat-programi-tur-operatoru` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 109 | `/blog/helal-turizm-pazari-stratejisi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 110 | `/en/blog/helal-turizm-pazari-stratejisi` | en | blog | `/blog/helal-turizm-pazari-stratejisi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 111 | `/de/blog/helal-turizm-pazari-stratejisi` | de | blog | `/blog/helal-turizm-pazari-stratejisi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 112 | `/fr/blog/helal-turizm-pazari-stratejisi` | fr | blog | `/blog/helal-turizm-pazari-stratejisi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 113 | `/es/blog/helal-turizm-pazari-stratejisi` | es | blog | `/blog/helal-turizm-pazari-stratejisi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 114 | `/blog/sezon-disi-gelir-stratejileri` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 2 |
| 115 | `/en/blog/sezon-disi-gelir-stratejileri` | en | blog | `/blog/sezon-disi-gelir-stratejileri` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 116 | `/de/blog/sezon-disi-gelir-stratejileri` | de | blog | `/blog/sezon-disi-gelir-stratejileri` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 117 | `/fr/blog/sezon-disi-gelir-stratejileri` | fr | blog | `/blog/sezon-disi-gelir-stratejileri` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 3 |
| 118 | `/es/blog/sezon-disi-gelir-stratejileri` | es | blog | `/blog/sezon-disi-gelir-stratejileri` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 3 |
| 119 | `/blog/acente-ilk-musteri-bulma-rehberi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 120 | `/en/blog/acente-ilk-musteri-bulma-rehberi` | en | blog | `/blog/acente-ilk-musteri-bulma-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 121 | `/de/blog/acente-ilk-musteri-bulma-rehberi` | de | blog | `/blog/acente-ilk-musteri-bulma-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 122 | `/fr/blog/acente-ilk-musteri-bulma-rehberi` | fr | blog | `/blog/acente-ilk-musteri-bulma-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 123 | `/es/blog/acente-ilk-musteri-bulma-rehberi` | es | blog | `/blog/acente-ilk-musteri-bulma-rehberi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 124 | `/blog/instagram-tiktok-tur-operatoru` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 125 | `/en/blog/instagram-tiktok-tur-operatoru` | en | blog | `/blog/instagram-tiktok-tur-operatoru` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 126 | `/de/blog/instagram-tiktok-tur-operatoru` | de | blog | `/blog/instagram-tiktok-tur-operatoru` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 127 | `/fr/blog/instagram-tiktok-tur-operatoru` | fr | blog | `/blog/instagram-tiktok-tur-operatoru` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 128 | `/es/blog/instagram-tiktok-tur-operatoru` | es | blog | `/blog/instagram-tiktok-tur-operatoru` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 129 | `/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 3 |
| 130 | `/en/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | en | blog | `/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 3 |
| 131 | `/de/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | de | blog | `/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 2 |
| 132 | `/fr/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | fr | blog | `/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 133 | `/es/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | es | blog | `/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 134 | `/blog/no-code-cozumler-tur-acentesi-yetersiz` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 135 | `/en/blog/no-code-cozumler-tur-acentesi-yetersiz` | en | blog | `/blog/no-code-cozumler-tur-acentesi-yetersiz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 136 | `/de/blog/no-code-cozumler-tur-acentesi-yetersiz` | de | blog | `/blog/no-code-cozumler-tur-acentesi-yetersiz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 137 | `/fr/blog/no-code-cozumler-tur-acentesi-yetersiz` | fr | blog | `/blog/no-code-cozumler-tur-acentesi-yetersiz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 3 |
| 138 | `/es/blog/no-code-cozumler-tur-acentesi-yetersiz` | es | blog | `/blog/no-code-cozumler-tur-acentesi-yetersiz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 3 |
| 139 | `/blog/ai-chatbot-roi-detayli-analiz` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 140 | `/en/blog/ai-chatbot-roi-detayli-analiz` | en | blog | `/blog/ai-chatbot-roi-detayli-analiz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 141 | `/de/blog/ai-chatbot-roi-detayli-analiz` | de | blog | `/blog/ai-chatbot-roi-detayli-analiz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 142 | `/fr/blog/ai-chatbot-roi-detayli-analiz` | fr | blog | `/blog/ai-chatbot-roi-detayli-analiz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 3 |
| 143 | `/es/blog/ai-chatbot-roi-detayli-analiz` | es | blog | `/blog/ai-chatbot-roi-detayli-analiz` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 3 |
| 144 | `/blog/incoming-acente-buyume-hikayesi` | tr | blog | — | 200 | kendisi | meta yok (index) | tr | 6/6 | 1 |
| 145 | `/en/blog/incoming-acente-buyume-hikayesi` | en | blog | `/blog/incoming-acente-buyume-hikayesi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 146 | `/de/blog/incoming-acente-buyume-hikayesi` | de | blog | `/blog/incoming-acente-buyume-hikayesi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 147 | `/fr/blog/incoming-acente-buyume-hikayesi` | fr | blog | `/blog/incoming-acente-buyume-hikayesi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |
| 148 | `/es/blog/incoming-acente-buyume-hikayesi` | es | blog | `/blog/incoming-acente-buyume-hikayesi` | 200 | kendisi | meta yok (index) | tr ✗ | 6/6 | 1 |

---

## 2) Çeviri kalitesi

**Yöntem (96 yabancı yazının tamamı, örneklem değil):** prerender HTML'inin `<article>` metni çıkarıldı.
- **Stopword skoru:** 5 dilin en sık 20 işlev kelimesinin metindeki oranı; en yüksek skor = tespit edilen dil.
- **TR ile metin benzerliği:** yabancı metnin kelime 3-gram'larının, aynı yazının TR gövdesinde geçme oranı. Kopya TR metinde ~%100, gerçek çeviride ~%0 çıkar.
- **TR harf yoğunluğu:** 1.000 karakterde ğ/ş/ı/İ/Ş/Ğ sayısı (TR gövde ort. 56).

| Dil | Yazı | Tespit edilen gövde dili | TR ile 3-gram örtüşme (ort. / en yüksek) | TR harfi /1000 | Ort. gövde |
|---|---|---|---|---|---|
| en | 30 | en ×30 | %0.8 / %2.0 | 0.14 | 13.678 kar. |
| de | 30 | de ×30 | %0.8 / %2.1 | 0.13 | 15.105 kar. |
| fr | 18 | fr ×18 | %0.5 / %1.3 | 0.13 | 15.199 kar. |
| es | 18 | es ×18 | %0.5 / %1.3 | 0.14 | 14.784 kar. |
| (tr) | 30 | tr ×30 | — | 56.17 | 13.407 kar. |

**Sonuç:** gövdeler **gerçekten o dilde**, TR'den kopya veya kısmi değil. Aykırı yazı (yanlış dil, %10 üstü örtüşme veya 2/1000 üstü TR harfi) **0**. Uzunluklar TR ile uyumlu (yazı kesilmemiş). Kalan TR parçalar, 96 sayfanın hepsinde:

| Kelime | Adet | Kaynak |
|---|---|---|
| "Paylaş" | 96 (her sayfada) | i18n `t()` → prerender'da TR (B1 kökü) |
| özel adlar: Ayşe Hanım, Sıtkı Oğrak, Kuşadası, Çeşme, Uludağ | 4'er | içerik gereği, sorun değil |

Ölçüm notu: FR/ES'de "TR stopword" %6–10 görünüyor. Bunun nedeni TR listesindeki "de/da/en" kelimelerinin FR/ES'de de bulunması (ölçüm yan etkisi); 3-gram örtüşme ve TR harf yoğunluğu çevirinin tam olduğunu gösteriyor.

### Örnek (her dilden 3)
| Dil | URL | Gövde dili | Stopword % (o dil / tr) | TR ile 3-gram örtüşme | TR harfi /1000 | Gövde (kar.) | Başlık (title) |
|---|---|---|---|---|---|---|---|
| en | `/en/blog/gunubirlik-tur-operatoru-rehberi` | en | 24.9 / 0.1 | %0.6 | 0.1 | 10053 | The Day-Tour Operator's Guide: Last-Minute Sales and Capacity Manageme |
| en | `/en/blog/incoming-acente-rehberi` | en | 25 / 0 | %0.7 | 0.1 | 11083 | How Does an Incoming Agency Work? A Guide to Entering the Foreign-Tour |
| en | `/en/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | en | 27.2 / 0 | %0.4 | 0.3 | 17855 | CRM for Travel Agencies: How Does a Customer List Turn into Gold? (Sea |
| de | `/de/blog/gunubirlik-tur-operatoru-rehberi` | de | 24.7 / 0.1 | %0.7 | 0.1 | 10975 | Leitfaden für Tagestour-Veranstalter: Last-Minute-Verkauf und Kapazitä |
| de | `/de/blog/incoming-acente-rehberi` | de | 24 / 0 | %0.8 | 0.1 | 12097 | Wie arbeitet eine Incoming-Agentur? Leitfaden für den Einstieg in den  |
| de | `/de/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | de | 23.8 / 0 | %0.4 | 0.3 | 19010 | CRM für Reisebüros: Wie wird eine Kundenliste zu Gold? (Saisonaler Wie |
| fr | `/fr/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | fr | 22.8 / 6.4 | %0.1 | 0.1 | 19971 | Tripler Vos Ventes de Circuits avec un Chatbot IA : Méthodes Éprouvées |
| fr | `/fr/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | fr | 22.8 / 5.8 | %0.3 | 0.1 | 18311 | Chatbot WhatsApp Agence de Voyage : Le Guide Complet 2026 / Turzz AI |
| fr | `/fr/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | fr | 24.5 / 5.5 | %1.3 | 0.1 | 19101 | Service Client Multilingue en 7 Langues : Guide pour Agences Réceptive |
| es | `/es/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | es | 30.8 / 9.9 | %0.2 | 0.1 | 18964 | Cómo Triplicar Ventas de Tours con un Chatbot IA: Métodos Probados / T |
| es | `/es/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | es | 31.6 / 10.4 | %0.3 | 0.1 | 17676 | Gestión de Clientes en WhatsApp para Agencias de Viajes: Guía 2026 / T |
| es | `/es/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | es | 30.1 / 8.4 | %1.3 | 0.1 | 18329 | Atención al Cliente Multilingüe en 7 Idiomas: Guía para Agencias Recep |

**Başlık/meta/description dili:** yabancı **yazılarda** title, meta description, `Article` JSON-LD headline/description/keywords **o dilde**. Yabancı **index'lerde** title + description TR (B6).

**Frontmatter'da TR kalan alanlar** (ör. `src/blog/posts/de/gunubirlik-tur-operatoru-rehberi.md:5,10,11`):
- `category: "Acente Rehberi"` → index kartlarında "Acente Rehberi" etiketi yabancı sayfada TR.
- `readingTime: "9 dk"` → sayı ayıklanıp `t("blog.minutesRead")` ile basılıyor (`BlogPost.tsx:322`). Etiket i18n'den gelir, prerender'da TR (B1).
- `slug:` TR (aşağıda).

### Slug'ları TR olan yabancı URL'ler
96 yabancı URL'nin **96'sı** TR slug kullanıyor; 30 farklı slug. Kök: `scripts/generate-sitemap.mjs:58-61` `buildLangUrl(lang, post.slug)` TR frontmatter slug'ını her dile uygular, yabancı .md dosyaları da aynı `slug:` değerini taşıyor (de klasöründe 30/30).

| TR slug (yabancı URL'de aynen) | Bu slug'la yayında olan yabancı diller |
|---|---|
| `acente-acarken-yapilan-10-hata` | en, de |
| `acente-icin-crm-musteri-listesi-yeniden-satis` | en, de |
| `acente-ilk-musteri-bulma-rehberi` | en, de, fr, es |
| `acenteler-icin-meta-reklam-rehberi` | en, de |
| `acenteler-icin-whatsapp-business-kurulumu` | en, de |
| `ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | en, de, fr, es |
| `ai-chatbot-roi-detayli-analiz` | en, de, fr, es |
| `gunubirlik-tur-operatoru-rehberi` | en, de |
| `helal-turizm-pazari-stratejisi` | en, de, fr, es |
| `incoming-acente-buyume-hikayesi` | en, de, fr, es |
| `incoming-acente-rehberi` | en, de |
| `instagram-tiktok-tur-operatoru` | en, de, fr, es |
| `internetten-tur-satisi-nasil-yapilir` | en, de |
| `manuel-whatsapp-vs-ai-chatbot-karsilastirma` | en, de, fr, es |
| `musteri-sadakat-programi-tur-operatoru` | en, de, fr, es |
| `no-code-cozumler-tur-acentesi-yetersiz` | en, de, fr, es |
| `seyahat-acentesi-dijital-donusum-adimlari` | en, de, fr, es |
| `seyahat-acentesi-nasil-acilir` | en, de |
| `seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | en, de, fr, es |
| `sezon-disi-gelir-stratejileri` | en, de, fr, es |
| `tur-iptal-ve-iade-politikasi-nasil-yazilir` | en, de |
| `tur-operatoru-otomasyon-yazilimi-karsilastirma` | en, de, fr, es |
| `turkiye-turizm-sektoru-2026-trendleri` | en, de, fr, es |
| `web-chatbot-mu-whatsapp-rezervasyon-asistani-mi` | en, de |
| `whatsapp-business-api-acente-rehberi` | en, de, fr, es |
| `whatsapp-chatbot-tur-satis-rehberi` | en, de, fr, es |
| `whatsapp-chatbot-yazilim-karsilastirma-2026` | en, de, fr, es |
| `whatsappta-musteri-neden-cevapsiz-birakir` | en, de |
| `yabanci-turiste-tur-satisi-cok-dilli-iletisim` | en, de |
| `yabanci-turistlere-cok-dilli-hizmet-rehberi` | en, de, fr, es |

---

## 3) İç link haritası

148 prerender sayfasının `<body>`'sindeki `<a href>`'ler toplandı (aynı host, `#`/sorgu atıldı, sayfanın kendine linki sayılmadı).

| Hedef klasör | Sayfa | Bu klasöre link veren farklı sayfa | …bunlardan **başka dilden** | Sayfa başı ort. gelen link | Yetim (0 gelen) |
|---|---|---|---|---|---|
| tr (`/…`) | 48 | 148 | 100 | 46.1 | 0 |
| en (`/en/…`) | 31 | 31 | **0** | 6.3 | **1** → `/en/blog` |
| de (`/de/…`) | 31 | 31 | **0** | 6.3 | **1** → `/de/blog` |
| fr (`/fr/…`) | 19 | 19 | **0** | 3.8 | **1** → `/fr/blog` |
| es (`/es/…`) | 19 | 19 | **0** | 3.8 | **1** → `/es/blog` |

- **TR sayfasından yabancı dil sayfasına `<a href>`: 0.** Ana sayfa dahil 48 TR sayfasının hiçbiri EN/DE/FR/ES'e bağlanmıyor.
- Yabancı klasörler yalnız **kendi içinde** birbirine bağlı (ilgili yazılar, index kartları). Dışarıdan giriş yok, yani her dil kümesi bir **ada**: Google o kümeye yalnız sitemap ve hreflang ile ulaşıyor.
- **Yetim sayfa (yalnız sitemap'te): 4.** Yabancı blog index'leri `/en/blog`, `/de/blog`, `/fr/blog`, `/es/blog`. Kök: header'daki Blog bağlantısı sabit `/blog` (`src/components/SiteHeader.tsx:44`), footer'daki de (`src/components/Layout.tsx:57`). Yabancı sayfa kendi index'ine değil TR index'e link veriyor.
- Zayıf bağlı: **77 sayfa** yalnız 1–2 sayfadan link alıyor. Örnekler: 5 aracın 4'ü, TR yazıların bir kısmı, fr/es yazılarının çoğu (çoğunun tek kaynağı kendi index'i).
- Sitemap dışı iç link hedefi: yalnız `/auth` (robots'ta Disallow, beklenen).
- FR index'inden TR'ye çapraz link: seri kartı `/blog/seyahat-acentesi-nasil-acilir` (FR/ES çevirisi yok). ES'de de aynı durum geçerli; bilgi.

**Dil seçici crawler için görünmez:** `src/components/LanguageSelector.tsx:40-66` Radix `Select`. Seçenekler `<a href>` değil, `onValueChange` → `i18n.changeLanguage` + yalnız blog yolunda `navigate()` (`:22-37`). Blog dışı sayfada URL hiç değişmiyor, yalnız istemcide metin çevriliyor. Ayrıca ru/ar seçenekleri blogda noindex kabuğa (`/ru/blog`) götürüyor.

---

## 4) Yabancı dil sayfalarında menü / footer / CTA / JSON-LD dili

Örnek: `/de/blog/gunubirlik-tur-operatoru-rehberi` (en/fr/es sayfalarında birebir aynı):

| Bölge | Prerender HTML'deki metin | Dil |
|---|---|---|
| Header menü | "Ana Sayfa · Özellikler · Blog · Araçlar · İletişim · Giriş Yap · Ücretsiz Dene" | **TR** |
| Dil seçici etiketi | "🇹🇷 Türkçe" | **TR** (sayfa Almanca iken) |
| Footer | "Ürün · WhatsApp Chatbot · AI Tur Rezervasyonu · … · KVKK Politikası · … © 2026 Turzz AI. Tüm hakları saklıdır." | **TR** |
| Yazı sonu CTA | "Turzz AI'ı Denediniz mi? 14 gün ücretsiz, kredi kartı gerekmez. Ücretsiz Başla" | **TR** |
| Paylaş düğmesi, okuma süresi etiketi, kategori rozeti | "Paylaş", "… dk", "Acente Rehberi" | **TR** |
| Yazı gövdesi, H1, TOC | Almanca | doğru |
| JSON-LD `Article` + `FAQPage` (`data-rh`, yazıya özel) | Almanca, `"inLanguage":"de"` | doğru |
| JSON-LD `Organization` + `SoftwareApplication` (`index.html:22-60`, her sayfada) | TR açıklama, `"inLanguage": "tr"` | **TR** (global) |
| `<html lang>`, `og:locale` | `tr`, `tr_TR` | **TR** |

**Önemli:** header/footer/CTA metinleri kodda **sabit TR değil**. `SiteHeader.tsx:74-116` ve `Layout.tsx:32-57` `t("nav.*")`/`t("footer.*")` kullanıyor; locale dosyaları dolu (en/de/fr/es/ru/ar: 3.146 anahtar, tr: 3.225, eksik 89). Yani lokalizasyon **çeviri işi değil**, yalnız prerender anında dilin doğru ayarlanması işi (§5).

---

## 5) Teknik: lang/hreflang nasıl üretilir, kök neden

**Prerender hattı:**
1. `prebuild` → `scripts/generate-sitemap.mjs` → `public/sitemap.xml`
2. `vite-react-ssg build` (`package.json:8-9`) → `vite.config.ts` `ssgOptions.includedRoutes` sitemap'i okur, prerender seti = sitemap seti
3. Her rota `src/routes.tsx` ağacıyla render edilir; head `vite-react-ssg` `<Head>` ile toplanır (`SEOHead.tsx:5,70-107`)
4. `scripts/spa-fallback.mjs` kabuk/404 üretir

**Kök neden (B1, B2, B6):**
- `src/i18n/index.ts:24-26`: prerender'da `localStorage` yok → `lng: 'tr'` sabit.
- Sayfa dili URL'den yalnız **`useEffect` içinde** değiştiriliyor (`BlogPost.tsx:209-214`, `Blog.tsx:238-242`). Effect'ler sunucu render'ında çalışmaz.
- Sonuç: `SEOHead` `<html lang={i18n.language}>` ve `og:locale` (`SEOHead.tsx:67,71`), header/footer `t()` çağrıları ve `t("blog.*")` etiketleri hep TR basılır. Yazı gövdesi ise doğru, çünkü `getPostBySlug(slug, lang)` dili **URL'den** (`getLangFromPath`) alıyor.
- `RtlEffect` (`src/routes.tsx:14-22`) da yalnız istemcide `document.documentElement.lang`'i düzeltiyor. Googlebot JS çalıştırdığında düzelir, ama ilk HTML (ve JS'siz tarayıcılar) TR görür. Google'ın render sonrası hangi değeri kullandığı **doğrulanmadı**.

**Düzeltmenin yapılacağı yer ve tuzak:**
- `vite-react-ssg` rotaları **eşzamanlı** render ediyor (`concurrency = 20` varsayılan, `node_modules/vite-react-ssg/dist/shared/vite-react-ssg.qp2k9AZ2.mjs:723`). Tek global i18n örneğinde render sırasında `changeLanguage` çağırmak sayfalar arası **yarış** yaratır: bir sayfa başka sayfanın dilini alabilir.
- Güvenli yol: URL dilini render'dan **önce** belirleyip o rota ağacına **rota başına i18n örneği** vermek. `i18n.cloneInstance({ lng })` + `I18nextProvider`, bir "dil yerleşimi" (`/:lang/*` sarmalayıcı veya route `loader`) içinde.
- Alternatif: `ssgOptions.concurrency: 1` + render başında senkron `changeLanguage` (daha basit, build yavaşlar, global durum riski kalır).

**hreflang üretimi:**
- Blog yazısı: `BlogPost.tsx:254-281` `extraLinks` → `SEOHead.tsx:99-101` (doğru çalışıyor).
- Blog index: `Blog.tsx:269-277`'ye aynı desenle eklenmeli (şu an yok).
- Statik sayfalar: yabancı URL'leri olmadığı için hreflang da yok (B7).

**Sitemap'te `xhtml:link` alternate:**
- **Var, yalnız blog yazılarında** (`generate-sitemap.mjs:158-187`; canlı: 684 satır, 126 URL; head ile 126/126 tutarlı). x-default: EN varsa EN, yoksa TR (`:166-167`).
- Statik sayfalar (`:130-139`) ve blog index'leri (`:141-156`) alternate'siz.
- `lastmod` statik ve index'te **build günü** (`:22,135,152`; canlı: 22 URL `2026-10-08`). Her deploy'da değiştiği için Google bu sinyale güvenmeyebilir (doğrulanmadı).

---

## 6) Önerilen Dalga 2 planı (seçenekli)

### Dil kararı: hangi diller tutulur?
Çeviri kalitesi engel değil (§2). Dil tutma/eleme kararı içerik hacmine ve giriş noktasına göre verilmeli:

| Dil | İçerik | Öneri | Gerekçe |
|---|---|---|---|
| en | 30 yazı + tools rotaları | **Tut**, öncelik 1 | Tam set, x-default hedefi |
| de | 30 yazı + tools rotaları | **Tut**, öncelik 1 | Tam set |
| fr | 18 yazı, tools yok | **Tut** | Çeviriler tam; 18 yazı yeterli küme. Noindex'e almak 18 gerçek çeviriyi çöpe atar |
| es | 18 yazı, tools yok | **Tut** | fr ile aynı |
| ru, ar | 0 yazı | **Mevcut hâl** (noindex, sitemap dışı) | Özgün içerik yok. Dil seçicide blog için gizlenmeli ya da index yerine TR'ye yönlendirilmeli |

"Birleştirme" (ör. fr/es'i en'e canonical) **önerilmez**: farklı dildeki çeviriler hreflang ile ilişkilendirilmeli, canonical ile birleştirilirse Google yabancı sürümü dizinden düşürür.

### Seçenekler

| Seçenek | İçerik | Etki | İş büyüklüğü |
|---|---|---|---|
| **A. Prerender dil düzeltmesi** | Rota başına i18n örneği (URL dili render öncesi) → `<html lang>`, `dir`, `og:locale`, header/footer/CTA/"Paylaş"/kategori/okuma süresi o dilde. Blog index'lerine dile göre title/description (i18n anahtarı) + hreflang + x-default. Global JSON-LD'ye `inLanguage` sayfa dili (ya da açıklamanın i18n'i) | **Yüksek.** B1, B2, B6 kapanır. "Karışık dil" sinyali biter | **Orta**, ~1–1,5 gün. Çeviri yok (anahtarlar hazır), kategori adları için ~10 anahtar |
| **B. Taranabilir dil bağlantıları + adaları bağlama** | (1) Header Blog bağlantısı `/{lang}/blog` (yabancı sayfada). (2) Footer'a "Bu sayfa: English · Deutsch · Français · Español" `<a href>` satırı: o sayfanın hreflang alternate'lerinden, yalnız var olan dillere. (3) Dil seçici: Radix Select yerine `<a href>`'li menü (JS ile yine aynı davranış). (4) TR blog yazısında "Read in English/Deutsch…" bağlantıları | **Yüksek.** B3 kapanır: yabancı kümeler TR'nin link otoritesine bağlanır, 4 yetim index biter | **Küçük–orta**, ~0,5–1 gün |
| **C. Sitemap düzeni** | Blog index'lerine alternate + x-default. Statik sayfalarda `lastmod` build günü yerine sabit/içerik tarihi. ru/ar'ı dil seçicinin blog dalından çıkar | **Orta.** Sinyal tutarlılığı | **Küçük**, ~2–3 saat |
| **D. Yabancı dilde giriş sayfaları** | `/en/`, `/de/` (+ fr/es) ana sayfa + 4 landing; `/en/tools`, `/de/tools` noindex'ten çıkarılıp prerender + sitemap + hreflang. UI metinleri locale'lerde var. Landing içeriklerinin i18n'li olup olmadığı **doğrulanmadı** | **Yüksek, uzun vadeli.** Yabancı arama için asıl giriş noktası. Blog adalarına yukarıdan link verir | **Büyük**, ~2–4 gün (rota yapısı, prerender seti, landing metinleri kontrolü, hreflang matrisi) |
| **E. Yerelleştirilmiş slug'lar** | Yabancı yazılara kendi dilinde slug + eski TR-slug'lı URL'lerden 301 | **Düşük–orta** (URL'deki anahtar kelime, kullanıcı güveni) | **Orta–büyük**. 96 URL yeniden keşif, 301 haritası, hreflang/sitemap güncellemesi. Dizinleme sorunu sürerken URL değiştirmek keşfi sıfırlar |
| **F. Daraltma** | fr/es'i noindex + sitemap dışı, yalnız en/de | Taranacak alan azalır, ama 36 gerçek çeviri kaybolur | Küçük, **önerilmez** |

### Benim önerim
1. **Dalga 2a (önce, birlikte): A + B + C.** Ölçülen üç kök (yanlış dil sinyali, karışık dilde arayüz, bağlantısız dil adaları) doğrudan "keşfedildi, dizine eklenmedi" ile uyumlu sorunlar ve çeviri gerektirmiyor. Toplam ~2–3 gün. Teslim kanıtı (curl): 82 yabancı sayfada `<html lang>` = URL dili; header/footer o dilde; yetim sayfa 0; TR→yabancı `<a href>` > 0; blog index'lerinde hreflang.
2. **Ardından 4–6 hafta Search Console ölçümü.** "Keşfedildi" → "dizine eklendi" geçişi dil bazında izlenmeli; şu anki GSC sayıları **doğrulanmadı**.
3. **Dalga 2b: D** (en/de giriş sayfaları + tools'un dizine açılması). 2a sonuç verirse bir sonraki büyük kaldıraç.
4. **E (slug) şimdilik yapılmasın.** Google'ın dil tespitinde URL slug'ı zayıf sinyal; dizinleme oturmadan URL değiştirmek keşfi sıfırlar. Dalga 2b sonrası yeniden değerlendirilsin.
5. **F önerilmez.** ru/ar mevcut noindex hâlinde kalsın.

---

## 7. Sade özet

Yabancı dildeki blog yazılarının metinleri gerçekten çevrilmiş ve iyi durumda; asıl sorun, sayfaların Google'a "Türkçe sayfa" diye sunulması ve menü, alt bilgi ve düğmelerin Türkçe kalması. İngilizce, Almanca, Fransızca ve İspanyolca sayfalara sitenin Türkçe kısmından hiç bağlantı yok; dil seçici de arama motorunun izleyebileceği bir bağlantı değil, bu yüzden her dil grubu yalnız site haritasıyla bulunabilen kopuk bir ada gibi duruyor. Önerim, önce sayfa dilini, menü/alt bilgi dilini ve diller arası bağlantıları düzeltmek (yaklaşık 2–3 gün, çeviri gerektirmiyor), birkaç hafta Search Console'u izlemek, sonra yabancı dilde ana sayfa ve araç sayfalarını açmak.
