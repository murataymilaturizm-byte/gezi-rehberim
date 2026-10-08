# turzzai.com — SEO Dalga 2a Sonuç Raporu (sayfa bazlı dil · hreflang · taranabilir dil bağlantıları)

**Tarih:** 2026-10-08 · **Commit:** `9aa2330` (kod) · teşhis raporu `9e6d9cb` · **Deploy:** Vercel (GitHub push → otomatik). Push 17:21'de; yeni sürüm 17:22:57'de canlıda gözlendi.
**Kaynak:** `docs/raporlar/TURZZAI-SEO-DALGA2-TESHIS.md` · **Ürün kararı:** EN/DE/FR/ES tutulur, RU/AR noindex kalır, slug'lara dokunulmaz.

> **Düzeltme (teşhis raporu):** teşhiste "yabancı dildeki 82 sayfa yanlış `<html lang>`" yazdım; doğrusu **100**. Yabancı sayfa sayısı EN 31 + DE 31 + FR 19 + ES 19 = 100. Teşhis tablosundaki "66 doğru" toplamı da hatalıydı, doğrusu 48; bu yüzden fark 82 çıkmıştı. Aşağıdaki "önce" sütunu aynı sabah ölçümünün yeniden sayılmış hâlidir.

---

## 1. Önce / sonra (canlı, 148 URL'nin tamamı Googlebot UA ile yeniden indirildi)

| Ölçüt | Önce (canlı, teşhis) | Sonra (canlı, deploy sonrası) |
|---|---|---|
| URL (sitemap) | 148 | 148 |
| HTTP 200 | 148 | 148 |
| canonical = kendisi | 148 | 148 |
| **Yanlış `<html lang>` (yabancı sayfa)** | 100 | 0 |
| Yanlış `<html lang>` (tümü) | 100 | 0 |
| Yanlış `og:locale` | 100 | 0 |
| **Menü dili URL dilinden farklı (yabancı)** | 100 | 0 |
| hreflang'lı sayfa | 126 | 131 |
| toplam head hreflang satırı | 684 | 714 |
| hreflang'lı sayfa: seti karşılıklı | 126 | 131 |
| hreflang → ru/ar | 0 | 0 |
| x-default TR olmayan | 126 | 0 |
| **Yetim yabancı blog ana sayfası** | 4 | 0 |
| Yetim sayfa (tümü) | 4 | 0 |
| **TR sayfalardan yabancı sayfaya `<a href>`** | 0 | 292 |
| …farklı yabancı hedef | 0 | 100 |
| Header'da 7 dil `<a hreflang>` olan sayfa | 0 | 148 |
| Yabancı sayfada menü Blog linki kendi dilinin blog'u | 0 | 100 |

Yabancı sayfalarda (100 sayfa) TR arayüz metni sayımı:

| Metin | Önce | Sonra |
|---|---|---|
| "Ana Sayfa" (menü) | 100 | 0 |
| "Ücretsiz Dene" (menü CTA) | 100 | 0 |
| "Tüm hakları saklıdır" (footer) | 100 | 0 |
| "Yardım Merkezi" (footer) | 100 | 0 |
| "dakika okuma" (okuma süresi) | 100 | 0 |
| "Paylaş" | 96 | 0 |
| "Acente Rehberi" (kategori) | 62 | 0 |
| " dk" | 62 | 0 |
| "Türkçe" | 100 | 100 (yalnız dil menüsündeki TR seçeneği; beklenen) |

Değişmeyen (doğru) sinyaller: 148/148 HTTP 200, 148/148 canonical kendisi, sitemap 148 URL. 126 yazının alternate seti korundu; yalnız x-default EN → TR oldu.

**Search Console notu (yapılacak, erişimim yok):**
1. Search Console → Dizin oluşturma → **Site haritaları** → `https://turzzai.com/sitemap.xml` → **Gönder**. Yeni alternate'ler (blog ana sayfaları) ve x-default değişikliği yeniden okunur.
2. **URL denetimi** → `https://turzzai.com/en/blog`, `/de/blog`, `/fr/blog`, `/es/blog` ve birer yazı (ör. `/en/blog/gunubirlik-tur-operatoru-rehberi`) → **Dizine eklenmesini iste**. Günlük kota sınırlı; dil başına 1–2 URL yeterli, gerisini bağlantılar taşır.
3. 2–4 hafta sonra "Sayfalar" raporunda dil klasörü bazında "Keşfedildi – dizine eklenmedi" sayısı izlenmeli. Şu anki GSC sayıları elimde yok (**doğrulanmadı**).

---

## 2. Ne yapıldı (talimat maddeleri)

### 2.1 Prerender'da sayfa bazlı dil (madde 1) ve eşzamanlılık
- **Kök:** `src/i18n/index.ts` prerender'da sabit `lng: 'tr'`. Blog sayfaları dili yalnız `useEffect` içinde değiştiriyordu, effect sunucuda çalışmaz.
- **Çözüm:** `src/components/UrlLangProvider.tsx` kök layout'u sarar (`src/routes.tsx`). Sayfanın dili URL'den (`/en/…`, önek yoksa `tr`) render **öncesinde** belirlenir ve o render ağacına **ayrı bir i18n örneği** verilir: `src/lib/i18n-for-lang.ts` → `i18n.cloneInstance({ lng, initAsync: false })`.
  - Kopya örnek çeviri deposunu paylaşır, dil durumu kendinedir. **Global örnek hiç değiştirilmez.** vite-react-ssg 20 sayfayı eşzamanlı render ettiği için bu şart.
- **Kapsam:** `<html lang>`, `dir`, `og:locale` (SEOHead, `i18n.language` artık sayfa dili), header menüsü, footer, CTA'lar, "Paylaş", dil seçici etiketi, okuma süresi birimi. Hepsi zaten `t()` kullanıyordu; yalnız dilin doğru örnekten gelmesi gerekiyordu.
- **Sabit TR metinler i18n'e bağlandı:** footer ürün etiketleri, "Yardım Merkezi", "Nasıl Başlarım?", "Karşılaştırma", "Blog". Mevcut anahtarlar kullanıldı; TR değerleri birebir aynı, TR sayfalar değişmedi. Karşılaştırma bağlantısı da sayfa dilindeki yazıya gidiyor.
- **Kategori etiketi:** EN/DE'deki 24 yazıda frontmatter'da çevrilmeden kalan `category: "Acente Rehberi"` → `"Agency Guide"` / `"Agentur-Leitfaden"` (seri bandıyla aynı adlar). FR/ES zaten çevriliydi.
- **Okuma süresi:** frontmatter `"11 dk"` / `"11 min"` metni `src/lib/blog.ts`'te sayıya çevriliyor. Birim `t("blog.minutesRead")`'den gelir (eskiden "11 dk min read" gibi karışık basılıyordu).
- **Panel istisnası:** `/admin`, `/auth`, `/reset-password` URL'den dil almaz (`isPanelPath`), kullanıcının kendi tercihi (global örnek + localStorage) aynen geçerli.
- **Eşzamanlılık testi:** `scripts/check-prerender-lang.mjs`, `npm run build`'in `postbuild` adımında çalışır.
  - **Koşum:** 148 sayfa tek koşumda, 20'şerli eşzamanlı ve sitemap sırasıyla üretiliyor. Aynı yazının tr/en/de/fr/es sürümleri art arda geldiği için aynı partide TR ve yabancı sayfalar karışık render ediliyor.
  - **Her sayfa için kontrol:** `<html lang>`, `og:locale`, menü "Ana Sayfa" karşılığı, footer telif cümlesi, yazıda "Paylaş" ve CTA başlığı, URL dilinin locale değerinde olmalı. Ayrıca yabancı sayfada TR menü metni sızıntısı aranıyor.
  - **Sonuç:** hata varsa build başarısız olur, Vercel deploy etmez.

| Build | `<html lang>` doğru | `og:locale` doğru | arayüz dili doğru | 7 dil `<a hreflang>` | karşılıklılık bozuk | hata |
|---|---|---|---|---|---|---|
| **HEAD (`9e6d9cb`) koduyla build, aynı kapı (önce kırmızı)** | **48/148** | 48/148 | 48/148 | **0/148** | 0 | **674** → çıkış 1 |
| **Dalga 2a koduyla build (sonra yeşil, yerel + Vercel)** | **148/148** | 148/148 | 148/148 | 148/148 | 0 | 0 → çıkış 0 |

### 2.2 Yabancı blog ana sayfaları (madde 2)
`src/pages/Blog.tsx`: başlık ve description 7 dilde i18n (`blog.indexSeoTitle` / `blog.indexSeoDescription`). Giriş paragrafı aynı anahtardan geliyor (eskiden sabit TR). hreflang seti tr/en/de/fr/es + x-default TR. Görünür "diğer dillerde" satırı var. Eski yerel `getLangFromPath` sonda `/` istediği için `/en/blog`'da `null` dönüyordu; tek kaynak `langFromPath` ile değiştirildi.

### 2.3 hreflang kuralı (madde 3)
Tek kaynak `src/lib/lang-routing.ts` → `pageAlternates` / `hreflangLinks`. SEOHead her sayfada bunu basar; BlogPost'un kendi seti kaldırıldı. Kurallar:
- **Yalnız var olan ve indexlenebilir karşılıklar:** yazı → o yazının bulunduğu tr/en/de/fr/es; blog ana sayfası → kendi yazısı olan diller. ru/ar hiçbir sette yok (canlı: 0). Statik sayfalarda (ana sayfa, landing, araçlar) yabancı karşılık olmadığı için hreflang yok; olmayan `/en` ana sayfasına işaret yok.
- **noindex sayfada hreflang basılmaz** (`/ru/blog`, `/ar/blog`).
- **x-default = TR** (canlı: TR dışına işaret eden x-default 0; önce 126'sı EN'e işaret ediyordu).
- **Karşılıklı:** setin her üyesi aynı fonksiyondan aynı seti üretir. Canlı: 131/131 sayfanın seti, setteki her sayfanın setiyle birebir aynı. Head seti ile sitemap seti 148/148 eşit (kapı kontrol ediyor).

### 2.4 Taranabilir dil bağlantıları (madde 4)
- **Dil seçici (`src/components/SiteLanguageMenu.tsx`):** Radix `Select` yerine `<details>` + 7 dil için gerçek `<a href hreflang lang>`. Seçenekler artık prerender HTML'inde var (eskiden yalnız açılınca DOM'a giriyordu ve `<a>` değildi). JS'siz de açılır.
  - **Hedef:** sayfanın o dildeki karşılığı; yoksa o dilin blog ana sayfası. Kendi yazısı olmayan ru/ar'a `rel="nofollow"`.
  - Panel/Auth/DemoChat eski seçiciyi kullanmaya devam ediyor (orada dil URL değil kullanıcı tercihi).
- **Menü/footer Blog linki** sayfa dilinin blog'u (`menuBlogHref`): `/en/blog`, `/de/blog`… (yabancı sayfalarda 100/100).
- **Görünür dil bağlantısı (`src/components/OtherLanguageLinks.tsx`):** TR ve yabancı yazıların başlığı altında ve blog ana sayfalarında "Diğer dillerde: English · Deutsch…" satırı; hreflang ile aynı kaynak.
- **Sonuç (canlı):** TR sayfalardan yabancı sayfalara `<a href>` **0 → 292** (100 farklı hedef). Yabancı klasörlere başka dillerden link veren sayfa EN/DE 0 → 117, FR/ES 0 → 129. Yetim yabancı blog ana sayfası **4 → 0**.
- **Tarayıcıda tıklama testi (yerel önizleme, puppeteer):**
  - `/blog/gunubirlik-…` (lang tr, menü "Ana Sayfa") → menüden English → `/en/blog/gunubirlik-…`, lang `en`, menü "Home", başlık İngilizce, menü kapanıyor, tercih `en` kaydediliyor.
  - → Deutsch → `/de/…`, lang `de`, "Startseite".
  - Ana sayfada EN hedefi `/en/blog`, RU bağlantısı `nofollow`. Sayfa hatası yok.

### 2.5 Sitemap (madde 5)
`scripts/generate-sitemap.mjs`: tek `alternateLinks` yardımcısı hem yazılarda hem blog ana sayfalarında kullanılıyor (head ile aynı kural, x-default TR). Blog ana sayfalarına 5 × 6 = **30 alternate** eklendi: `xhtml:link` 684 → **714**. 126 yazının alternate'leri korundu, yalnız x-default EN → TR.

---

## 3. KARAR GEREKLİ (en güvenli seçenek uygulandı, bilgi)

| # | Konu | Uygulanan | Gerekçe / etki |
|---|---|---|---|
| K1 | Ana sayfa ve TR statik sayfalarda dil | URL dili otorite: bu sayfalar her zaman TR render edilir. Daha önce tarayıcıda "preferred-language" tercihi olan ziyaretçi bu sayfaları istemcide o dilde görüyordu | Bu sayfaların yabancı URL'si yok. Tercihe göre istemcide dil değiştirmek prerender HTML'iyle çelişiyordu (hidrasyon farkı + Google'ın gördüğüyle kullanıcının gördüğü farklı). Dil menüsü artık ilgili dilin blog'una götürüyor. Ana sayfadaki DemoChat'in kendi dil seçicisi sayfa içi dili değiştirmeye devam ediyor (eski davranış) |
| K2 | RU/AR dil menüsünde | Gösterilir, `/ru/blog` `/ar/blog`'a (noindex) `rel="nofollow"` ile | Talimat "karşılık yoksa o dilin blog ana sayfası". noindex sayfaya taramayı yönlendirmemek için nofollow |
| K3 | TR araç sayfalarının dil karşılığı | Yok sayıldı. EN/DE araç rotaları (`/en/tools…`) hâlâ noindex SPA kabuğu, dil menüsü EN için `/en/blog`'a gidiyor | Talimat: hreflang yalnız indexlenebilir karşılıklara. Araçların açılması Dalga 2b |
| K4 | Global JSON-LD (`index.html` Organization/SoftwareApplication) TR açıklama | Dokunulmadı | Talimat listesinde yok; yazıya özel Article/FAQPage JSON-LD zaten o dilde. Dalga 2b'de lokalize edilebilir |
| K5 | Kategori adları | EN "Agency Guide", DE "Agentur-Leitfaden" | Aynı serinin bandında zaten kullanılan adlar ("The Agency Guide Series", "Die Agentur-Leitfaden-Serie") |

---

## 4. Testler

- **`npm test`:** suite **1674 ✓** / 0 ✗ (+20 "DIL." muhafızı: kök layout sağlayıcısı, sayfa başına kopya örnek, render sırasında `changeLanguage` yok, header taranabilir menü, Blog linki sayfa dilinde, footer'da sabit TR yok, SEOHead hreflang tek kaynak, x-default TR, sitemap 714 alternate, ru/ar'a hreflang yok, postbuild kapısı, EN/DE'de TR kategori yok, okuma süresi sayı) · harness 154 · webhook 23 · EXIT 0.
- **`npm run typecheck`:** 72 hata önce = 72 sonra, **birebir aynı küme** (HEAD ile stash karşılaştırması; hepsi önceden var olan panel/Supabase tip hataları, yeni hata yok).
- **eslint (değişen dosyalar):** yeni dosyalar temiz. `BlogPost.tsx:185-195` 5 `any` hatası önceden var (markdown bileşenleri).
- **`npm run build`:** başarılı + postbuild dil kapısı yeşil (yerel ve Vercel'de; Vercel'de kapı kırmızı olsaydı deploy olmazdı).
- **Tarayıcı duman testi (`scripts/smoke_pages.cjs`, gerçek Chrome, yerel önizleme):**
  - 28/28 rota geçti. Yeni eklenen rotalar: `/fr/blog`, `/es/blog` ve 3 yabancı yazı.
  - Yeni kontrol: hidrasyondan sonra da `document.documentElement.lang` = URL dili.
  - Değişen sayfalarda hidrasyon uyarısı yok (yalnız 404 rotalarında önceden bilinen uyarı).

---

## 5. Örnek sayfalar (canlı HTML, deploy sonrası)

### 5.1 EN yazı: `/en/blog/gunubirlik-tur-operatoru-rehberi`
```html
<html lang="en" dir="ltr">
<title data-rh="true">The Day-Tour Operator's Guide: Last-Minute Sales and Capacity Management (2026) | Turzz AI</title>
<meta data-rh="true" name="description" content="How do you cut empty seats on day tours? The logic of last-minute demand, …">
<meta data-rh="true" property="og:locale" content="en_US">
<link data-rh="true" rel="canonical" href="https://turzzai.com/en/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="tr" href="https://turzzai.com/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="en" href="https://turzzai.com/en/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="de" href="https://turzzai.com/de/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="x-default" href="https://turzzai.com/blog/gunubirlik-tur-operatoru-rehberi">
```
Menü: `Home · Features · Blog (/en/blog) · Tools · Contact`. Dil seçici (sınıflar ve ikonlar çıkarılmış):
```html
<details>
  <summary aria-label="Choose language">🇬🇧 English</summary>
  <ul>
    <li><a hreflang="tr" lang="tr" href="/blog/gunubirlik-tur-operatoru-rehberi">🇹🇷 Türkçe</a></li>
    <li><a hreflang="en" lang="en" aria-current="page" href="/en/blog/gunubirlik-tur-operatoru-rehberi">🇬🇧 English</a></li>
    <li><a hreflang="de" lang="de" href="/de/blog/gunubirlik-tur-operatoru-rehberi">🇩🇪 Deutsch</a></li>
    <li><a hreflang="ru" lang="ru" rel="nofollow" href="/ru/blog">🇷🇺 Русский</a></li>
    <li><a hreflang="ar" lang="ar" rel="nofollow" href="/ar/blog">🇸🇦 العربية</a></li>
    <li><a hreflang="fr" lang="fr" href="/fr/blog">🇫🇷 Français</a></li>
    <li><a hreflang="es" lang="es" href="/es/blog">🇪🇸 Español</a></li>
  </ul>
</details>
<nav aria-label="Also available in:">Also available in: <a hreflang="tr" lang="tr" href="/blog/gunubirlik-tur-operatoru-rehberi">Türkçe</a> · <a hreflang="de" lang="de" href="/de/blog/gunubirlik-tur-operatoru-rehberi">Deutsch</a></nav>
```

### 5.2 DE blog ana sayfası: `/de/blog`
```html
<html lang="de" dir="ltr">
<title data-rh="true">Blog — Leitfäden zu WhatsApp-Chatbots und Reisetechnologie | Turzz AI</title>
<meta data-rh="true" name="description" content="WhatsApp-Chatbot-Leitfäden für Reisebüros, KI-Reisetechnologie und Tipps zur digitalen Transformation. Der Turzz AI Blog.">
<meta data-rh="true" property="og:locale" content="de_DE">
<link data-rh="true" rel="canonical" href="https://turzzai.com/de/blog">
<link data-rh="true" rel="alternate" hreflang="tr" href="https://turzzai.com/blog">
<link data-rh="true" rel="alternate" hreflang="en" href="https://turzzai.com/en/blog">
<link data-rh="true" rel="alternate" hreflang="de" href="https://turzzai.com/de/blog">
<link data-rh="true" rel="alternate" hreflang="fr" href="https://turzzai.com/fr/blog">
<link data-rh="true" rel="alternate" hreflang="es" href="https://turzzai.com/es/blog">
<link data-rh="true" rel="alternate" hreflang="x-default" href="https://turzzai.com/blog">
```
Menü: `Startseite · Funktionen · Blog (/de/blog) · Werkzeuge · Kontakt`. Dil seçici: `summary aria-label="Sprache wählen"` → Deutsch; hedefler `/blog`, `/en/blog`, `/de/blog` (aria-current), `/ru/blog` (nofollow), `/ar/blog` (nofollow), `/fr/blog`, `/es/blog`. Görünür satır: "Auch verfügbar auf: Türkçe · English · Français · Español".

### 5.3 TR yazı: `/blog/gunubirlik-tur-operatoru-rehberi`
```html
<html lang="tr" dir="ltr">
<title data-rh="true">Günübirlik Tur Operatörü Rehberi: Son Dakika Satışı ve Kontenjan Yönetimi (2026) | Turzz AI</title>
<meta data-rh="true" property="og:locale" content="tr_TR">
<link data-rh="true" rel="canonical" href="https://turzzai.com/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="tr" href="https://turzzai.com/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="en" href="https://turzzai.com/en/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="de" href="https://turzzai.com/de/blog/gunubirlik-tur-operatoru-rehberi">
<link data-rh="true" rel="alternate" hreflang="x-default" href="https://turzzai.com/blog/gunubirlik-tur-operatoru-rehberi">
```
Menü: `Ana Sayfa · Özellikler · Blog (/blog) · Araçlar · İletişim`. Dil seçici: `summary aria-label="Dil seçin"` → Türkçe; EN/DE hedefleri yazının karşılıkları. Görünür satır: "Diğer dillerde: English · Deutsch".

---

## 6. Pre-delete tablosu + net satır

| Silinen / değişen | Neden | Yerine |
|---|---|---|
| `Blog.tsx` + `BlogPost.tsx` `useEffect(() => i18n.changeLanguage(urlLang))` | Prerender'da çalışmıyordu; çalışsaydı global örneği eşzamanlı render'da değiştirirdi | `UrlLangProvider` (sayfa başına kopya örnek) |
| `Blog.tsx` yerel `getLangFromPath` (sonda `/` isteyen regex) + `SUPPORTED_LANGS` | `/en/blog`'da `null` dönüyordu | `lang-routing.langFromPath` |
| `Blog.tsx` sabit TR `title`/`description`/giriş paragrafı | Yabancı index'ler TR başlıklıydı | `t("blog.indexSeoTitle/indexSeoDescription")` (7 dil) |
| `BlogPost.tsx` yerel hreflang dizisi (x-default EN) + `extraLinks` prop'u | Kural iki yerdeydi, x-default EN | `SEOHead` → `hreflangLinks(pathname)` (x-default TR) |
| `SEOHead.tsx` `OG_LOCALE_MAP`, `HreflangLink` arayüzü, `extraLinks` | Tek kaynağa taşındı | `lang-routing` (`OG_LOCALE`, `hreflangLinks`) |
| `SiteHeader.tsx` `<LanguageSelector />` ×2 + Blog `href: "/blog"` | Radix seçici crawler'a görünmüyordu; Blog linki hep TR | `<SiteLanguageMenu />`, `menuBlogHref(lang)` |
| `Layout.tsx` sabit TR footer etiketleri + `/blog` | Yabancı sayfa footer'ı TR | `t("footer.*")`, `menuBlogHref`, karşılaştırma için `postHref` |
| `generate-sitemap.mjs` x-default "EN varsa EN" + yazıya özel alternate döngüsü | x-default ürün kararı TR; blog index alternate'siz | `alternateLinks()` (yazı + index, x-default TR) |
| EN/DE 24 yazının `category: "Acente Rehberi"` | Çevrilmemiş kategori | "Agency Guide" / "Agentur-Leitfaden" |
| `blog.ts` `readingTime` metin olarak | "11 dk min read" | sayı (`parseInt`) |

**Net satır (`git diff --numstat 9e6d9cb 9aa2330`):**
- Üretim kodu: +307 / −95 = **+212**. Yeni dosyalar: `lang-routing.ts` 109, `SiteLanguageMenu.tsx` 57, `OtherLanguageLinks.tsx` 30, `UrlLangProvider.tsx` 27, `i18n-for-lang.ts` 8 (çoğu açıklama yorumu).
- Test/kapı: **+161** (`check-prerender-lang.mjs` 110, suite +43, duman +8).
- Çeviri (7 locale): +28.
- İçerik (24 .md): ±24, net 0.
- Üretilen sitemap: +30 alternate.
- Net pozitif, çünkü bu dalga eksik olan altyapıyı ekliyor: dil-URL kural modülü, taranabilir menü, build kapısı. Silinen kopyalar (yerel dil regex'i, BlogPost hreflang dizisi, SEOHead locale tablosu, iki `useEffect`) tek kaynağa taşındı.

---

## 7. Kalan (Dalga 2b adayları, bu dalgada yok)
- EN/DE/FR/ES ana sayfa + 4 landing (`/en/` …) ve EN/DE araç sayfalarının noindex'ten çıkarılması (teşhis seçenek D).
- Global JSON-LD açıklamasının lokalizasyonu (K4).
- Statik sayfa `lastmod`'unun build günü yerine içerik tarihi olması (teşhis seçenek C'nin kalan kısmı).
- Search Console ölçümü: sitemap gönderiminden 2–4 hafta sonra dil bazında "keşfedildi → dizine eklendi" geçişi.

---

## 8. Tam tablo: canlı, deploy sonrası (148 URL)
Sütunlar: hreflang = head'deki alternate sayısı (x-default dahil) · karşılıklı = setteki her sayfa aynı seti basıyor mu · menü dili = header'daki "Ana Sayfa" karşılığının dili · header dil linki = header'daki `<a hreflang>` sayısı · gelen iç link = bu sayfaya link veren farklı sayfa sayısı.

| # | URL | Dil | HTTP | canonical | `<html lang>` | og:locale | hreflang | karşılıklı | menü dili | header dil linki | gelen iç link |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 147 |
| 2 | `/whatsapp-chatbot-seyahat-acentesi` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 141 |
| 3 | `/ai-tur-rezervasyonu` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 141 |
| 4 | `/cok-dilli-musteri-hizmetleri` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 141 |
| 5 | `/tur-otomasyonu` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 141 |
| 6 | `/araclar` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 47 |
| 7 | `/araclar/rehber-sozlesmesi-olusturucu` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 1 |
| 8 | `/araclar/tur-kar-hesaplayici` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 3 |
| 9 | `/araclar/tur-satis-sozlesmesi-olusturucu` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 2 |
| 10 | `/araclar/tur-teklifi-olusturucu` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 1 |
| 11 | `/araclar/transfer-sozlesmesi-olusturucu` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 2 |
| 12 | `/nasil-baslarim` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 142 |
| 13 | `/yardim` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 142 |
| 14 | `/privacy-policy` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 142 |
| 15 | `/terms-of-service` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 142 |
| 16 | `/data-deletion` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 143 |
| 17 | `/data-export` | tr | 200 | kendisi | tr | tr_TR | 0 | — | tr | 7 | 143 |
| 18 | `/blog` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 51 |
| 19 | `/en/blog` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 51 |
| 20 | `/de/blog` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 51 |
| 21 | `/fr/blog` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 75 |
| 22 | `/es/blog` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 75 |
| 23 | `/blog/gunubirlik-tur-operatoru-rehberi` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 33 |
| 24 | `/en/blog/gunubirlik-tur-operatoru-rehberi` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 32 |
| 25 | `/de/blog/gunubirlik-tur-operatoru-rehberi` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 32 |
| 26 | `/blog/incoming-acente-rehberi` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 33 |
| 27 | `/en/blog/incoming-acente-rehberi` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 32 |
| 28 | `/de/blog/incoming-acente-rehberi` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 32 |
| 29 | `/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 35 |
| 30 | `/en/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 31 |
| 31 | `/de/blog/acente-icin-crm-musteri-listesi-yeniden-satis` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 31 |
| 32 | `/blog/yabanci-turiste-tur-satisi-cok-dilli-iletisim` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 16 |
| 33 | `/en/blog/yabanci-turiste-tur-satisi-cok-dilli-iletisim` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 16 |
| 34 | `/de/blog/yabanci-turiste-tur-satisi-cok-dilli-iletisim` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 16 |
| 35 | `/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 8 |
| 36 | `/en/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 5 |
| 37 | `/de/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 5 |
| 38 | `/blog/whatsappta-musteri-neden-cevapsiz-birakir` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 15 |
| 39 | `/en/blog/whatsappta-musteri-neden-cevapsiz-birakir` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 15 |
| 40 | `/de/blog/whatsappta-musteri-neden-cevapsiz-birakir` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 15 |
| 41 | `/blog/acenteler-icin-meta-reklam-rehberi` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 10 |
| 42 | `/en/blog/acenteler-icin-meta-reklam-rehberi` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 10 |
| 43 | `/de/blog/acenteler-icin-meta-reklam-rehberi` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 10 |
| 44 | `/blog/internetten-tur-satisi-nasil-yapilir` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 9 |
| 45 | `/en/blog/internetten-tur-satisi-nasil-yapilir` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 9 |
| 46 | `/de/blog/internetten-tur-satisi-nasil-yapilir` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 9 |
| 47 | `/blog/acente-acarken-yapilan-10-hata` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 8 |
| 48 | `/en/blog/acente-acarken-yapilan-10-hata` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 6 |
| 49 | `/de/blog/acente-acarken-yapilan-10-hata` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 6 |
| 50 | `/blog/web-chatbot-mu-whatsapp-rezervasyon-asistani-mi` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 15 |
| 51 | `/en/blog/web-chatbot-mu-whatsapp-rezervasyon-asistani-mi` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 15 |
| 52 | `/de/blog/web-chatbot-mu-whatsapp-rezervasyon-asistani-mi` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 15 |
| 53 | `/blog/acenteler-icin-whatsapp-business-kurulumu` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 16 |
| 54 | `/en/blog/acenteler-icin-whatsapp-business-kurulumu` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 16 |
| 55 | `/de/blog/acenteler-icin-whatsapp-business-kurulumu` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 16 |
| 56 | `/blog/seyahat-acentesi-nasil-acilir` | tr | 200 | kendisi | tr | tr_TR | 4 | evet | tr | 7 | 9 |
| 57 | `/en/blog/seyahat-acentesi-nasil-acilir` | en | 200 | kendisi | en | en_US | 4 | evet | en | 7 | 7 |
| 58 | `/de/blog/seyahat-acentesi-nasil-acilir` | de | 200 | kendisi | de | de_DE | 4 | evet | de | 7 | 7 |
| 59 | `/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 60 | `/en/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 61 | `/de/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 62 | `/fr/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 22 |
| 63 | `/es/blog/ai-chatbot-ile-tur-satisini-nasil-arttirirsiniz` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 22 |
| 64 | `/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 65 | `/en/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 66 | `/de/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 67 | `/fr/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 19 |
| 68 | `/es/blog/seyahat-acentesi-whatsapp-musteri-yonetimi-rehberi` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 19 |
| 69 | `/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 6 |
| 70 | `/en/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 6 |
| 71 | `/de/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 6 |
| 72 | `/fr/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 17 |
| 73 | `/es/blog/yabanci-turistlere-cok-dilli-hizmet-rehberi` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 17 |
| 74 | `/blog/whatsapp-business-api-acente-rehberi` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 75 | `/en/blog/whatsapp-business-api-acente-rehberi` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 76 | `/de/blog/whatsapp-business-api-acente-rehberi` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 77 | `/fr/blog/whatsapp-business-api-acente-rehberi` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 8 |
| 78 | `/es/blog/whatsapp-business-api-acente-rehberi` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 8 |
| 79 | `/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 6 |
| 80 | `/en/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 6 |
| 81 | `/de/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 6 |
| 82 | `/fr/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 6 |
| 83 | `/es/blog/tur-operatoru-otomasyon-yazilimi-karsilastirma` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 6 |
| 84 | `/blog/whatsapp-chatbot-tur-satis-rehberi` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 85 | `/en/blog/whatsapp-chatbot-tur-satis-rehberi` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 86 | `/de/blog/whatsapp-chatbot-tur-satis-rehberi` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 87 | `/fr/blog/whatsapp-chatbot-tur-satis-rehberi` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 5 |
| 88 | `/es/blog/whatsapp-chatbot-tur-satis-rehberi` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 5 |
| 89 | `/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 44 |
| 90 | `/en/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 34 |
| 91 | `/de/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 34 |
| 92 | `/fr/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 22 |
| 93 | `/es/blog/manuel-whatsapp-vs-ai-chatbot-karsilastirma` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 22 |
| 94 | `/blog/seyahat-acentesi-dijital-donusum-adimlari` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 95 | `/en/blog/seyahat-acentesi-dijital-donusum-adimlari` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 96 | `/de/blog/seyahat-acentesi-dijital-donusum-adimlari` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 97 | `/fr/blog/seyahat-acentesi-dijital-donusum-adimlari` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 5 |
| 98 | `/es/blog/seyahat-acentesi-dijital-donusum-adimlari` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 5 |
| 99 | `/blog/turkiye-turizm-sektoru-2026-trendleri` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 100 | `/en/blog/turkiye-turizm-sektoru-2026-trendleri` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 101 | `/de/blog/turkiye-turizm-sektoru-2026-trendleri` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 102 | `/fr/blog/turkiye-turizm-sektoru-2026-trendleri` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 5 |
| 103 | `/es/blog/turkiye-turizm-sektoru-2026-trendleri` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 5 |
| 104 | `/blog/musteri-sadakat-programi-tur-operatoru` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 6 |
| 105 | `/en/blog/musteri-sadakat-programi-tur-operatoru` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 6 |
| 106 | `/de/blog/musteri-sadakat-programi-tur-operatoru` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 6 |
| 107 | `/fr/blog/musteri-sadakat-programi-tur-operatoru` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 5 |
| 108 | `/es/blog/musteri-sadakat-programi-tur-operatoru` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 5 |
| 109 | `/blog/helal-turizm-pazari-stratejisi` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 110 | `/en/blog/helal-turizm-pazari-stratejisi` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 111 | `/de/blog/helal-turizm-pazari-stratejisi` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 112 | `/fr/blog/helal-turizm-pazari-stratejisi` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 5 |
| 113 | `/es/blog/helal-turizm-pazari-stratejisi` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 5 |
| 114 | `/blog/sezon-disi-gelir-stratejileri` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 6 |
| 115 | `/en/blog/sezon-disi-gelir-stratejileri` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 6 |
| 116 | `/de/blog/sezon-disi-gelir-stratejileri` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 6 |
| 117 | `/fr/blog/sezon-disi-gelir-stratejileri` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 7 |
| 118 | `/es/blog/sezon-disi-gelir-stratejileri` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 7 |
| 119 | `/blog/acente-ilk-musteri-bulma-rehberi` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 120 | `/en/blog/acente-ilk-musteri-bulma-rehberi` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 121 | `/de/blog/acente-ilk-musteri-bulma-rehberi` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 122 | `/fr/blog/acente-ilk-musteri-bulma-rehberi` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 5 |
| 123 | `/es/blog/acente-ilk-musteri-bulma-rehberi` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 5 |
| 124 | `/blog/instagram-tiktok-tur-operatoru` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 125 | `/en/blog/instagram-tiktok-tur-operatoru` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 126 | `/de/blog/instagram-tiktok-tur-operatoru` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 127 | `/fr/blog/instagram-tiktok-tur-operatoru` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 5 |
| 128 | `/es/blog/instagram-tiktok-tur-operatoru` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 5 |
| 129 | `/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 7 |
| 130 | `/en/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 7 |
| 131 | `/de/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 6 |
| 132 | `/fr/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 5 |
| 133 | `/es/blog/whatsapp-chatbot-yazilim-karsilastirma-2026` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 5 |
| 134 | `/blog/no-code-cozumler-tur-acentesi-yetersiz` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 135 | `/en/blog/no-code-cozumler-tur-acentesi-yetersiz` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 136 | `/de/blog/no-code-cozumler-tur-acentesi-yetersiz` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 137 | `/fr/blog/no-code-cozumler-tur-acentesi-yetersiz` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 7 |
| 138 | `/es/blog/no-code-cozumler-tur-acentesi-yetersiz` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 7 |
| 139 | `/blog/ai-chatbot-roi-detayli-analiz` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 140 | `/en/blog/ai-chatbot-roi-detayli-analiz` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 141 | `/de/blog/ai-chatbot-roi-detayli-analiz` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 142 | `/fr/blog/ai-chatbot-roi-detayli-analiz` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 7 |
| 143 | `/es/blog/ai-chatbot-roi-detayli-analiz` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 7 |
| 144 | `/blog/incoming-acente-buyume-hikayesi` | tr | 200 | kendisi | tr | tr_TR | 6 | evet | tr | 7 | 5 |
| 145 | `/en/blog/incoming-acente-buyume-hikayesi` | en | 200 | kendisi | en | en_US | 6 | evet | en | 7 | 5 |
| 146 | `/de/blog/incoming-acente-buyume-hikayesi` | de | 200 | kendisi | de | de_DE | 6 | evet | de | 7 | 5 |
| 147 | `/fr/blog/incoming-acente-buyume-hikayesi` | fr | 200 | kendisi | fr | fr_FR | 6 | evet | fr | 7 | 5 |
| 148 | `/es/blog/incoming-acente-buyume-hikayesi` | es | 200 | kendisi | es | es_ES | 6 | evet | es | 7 | 5 |

---

## 9. Sade özet

Sitenin İngilizce, Almanca, Fransızca ve İspanyolca sayfaları artık Google'a kendi dillerinde sunuluyor: sayfa dili, menü, alt bilgi ve düğmeler o dilde; eskiden 100 yabancı sayfanın hepsi "Türkçe" görünüyordu. Her yazı ve blog ana sayfası diğer dillerdeki karşılıklarını doğru ve karşılıklı biçimde gösteriyor; dil seçici artık arama motorunun izleyebileceği gerçek bağlantılar içeriyor, Türkçe sayfalardan yabancı sayfalara 292 bağlantı var ve hiçbir yabancı blog ana sayfası kopuk kalmadı. Site haritasını Search Console'dan yeniden göndermeniz ve birkaç hafta dizine eklenme sayılarını izlemeniz yeterli; bir sonraki adım yabancı dilde ana sayfa ve araç sayfalarını açmak.
