// ARAÇ-1 / kardeş-makale (SEO yüzeyi) — MARKDOWN tek kaynağı.
// Markdown seçilmesinin nedeni mimari: aynı metin hem ReactMarkdown ile render
// edilir hem de blog-anatomy'deki extractFaq() ile FAQPage şemasına dönüşür —
// ikinci bir "şema listesi" tutmaya gerek kalmaz (tek-kaynak).
// SSS biçimi M-serisiyle AYNI olmalı: "## Sık Sorulan Sorular (SSS)" başlığı +
// her soru **kalın-paragraf** — extractFaq bu deseni parse eder.

export const ARTICLE_MD = `
## Rehber Sözleşmesi Neden Yazılı Olmalı?

Tur rehberliği, sezon boyunca çoğu zaman telefonla ve güvene dayalı yürüyen bir ilişkidir: "cumartesi Kapadokya'ya gelebilir misin?" mesajıyla kurulan, ücreti sözlü konuşulan, koşulları hiç yazılmayan bir çalışma düzeni. İşler yolunda gittiğinde bu düzenin sorunu görünmez. Sorun, bir aksaklık çıktığı gün ortaya çıkar: tur son anda iptal olur ve rehber "ben o günü size ayırdım" der; grup beklenenin iki katı çıkar; ödeme tarihi konusunda iki taraf farklı şeyler hatırlar. O gün, tartışmanın çözümünü belirleyen tek şey ne konuşulduğu değil, **neyin yazıldığıdır.**

Yazılı sözleşmenin amacı taraflardan birini korumak değil, ikisinin de aynı metni okumasıdır. İyi bir rehber sözleşmesi, sezon ortasında hatırlanması gereken beş şeyi tek sayfaya sabitler: kim, hangi tur, hangi tarihlerde, ne karşılığında ve aksaklık hâlinde ne olacak.

## Sözleşmenin Ana Maddeleri Ne Anlama Gelir?

**Taraflar.** Basit görünen bu bölüm, anlaşmazlıkta en çok işe yarayan bölümdür: acentenin unvanı ve adresi, rehberin adı ve iletişim bilgisi. Rehberin mesleki belge numarası yazılacaksa yazılır; yazılmayacaksa madde onsuz da geçerlidir — sözleşmeyi kimlik-bilgisi deposuna çevirmeye gerek yoktur.

**Sözleşmenin konusu.** Turun adı, güzergâhı ve hizmetin verileceği dil. "Kapadokya turu" ile "Kapadokya 2 gece 3 gün kültür turu, Almanca rehberlik" arasındaki fark, uyuşmazlık gününde her şeyi belirler.

**Süre ve görev takvimi.** Başlangıç-bitiş tarihi ve varsa günlük çalışma düzeni. Günlük saat yazmak zorunlu değildir; ama yazılmadığında "günün sonu" kavramı taraflara göre değişir — özellikle geç dönüşlü turlarda en sık tartışma buradan çıkar.

**Ücret ve ödeme.** Tutar, para birimi ve hesaplama biçimi (tur başına mı, gün başına mı?). Bir de çoğu sözlü anlaşmanın atladığı soru: **ne zaman ödenecek?** "Tur bitince" ifadesi, biri için ertesi gün diğeri için ay sonu demektir. Gün sayısı yazmak, bu belirsizliği tek kelimeyle bitirir.

**Masraflar.** Konaklama, ulaşım, yemek, müze girişleri kime ait? Sektörde en sık yaşanan gerilim, ücretin değil masrafın konuşulmamış olmasından doğar. Sözleşmede bu kalemler sayılmıyorsa, sayılmadığı için yok sayılmaz — sahada karşınıza çıkar.

**İptal ve değişiklik.** Burada tek taraflı metin yazmak cazip gelir ama işe yaramaz: iyi bir madde simetriktir. Acente iptal ederse ne olur, rehber gelemezse ne olur — ikisi de yazılır. Karşı tarafın da korunduğu bir metin, imzalanması kolay ve savunulması sağlam olan metindir.

**Mücbir sebep.** Hava koşulu, yol kapanması, resmî karar. Kimsenin kusuru olmadan hizmetin verilemediği hâlleri düzenler. Bu maddenin işlevi kimseyi haklı çıkarmak değil, "şimdi ne yapacağız" sorusunu önceden cevaplamaktır.

**Yürürlük ve fesih.** İptal maddesinden ayrı bir maddedir ve karıştırılmaması gerekir: iptal, tek bir turun yapılmamasını düzenler; fesih, sözleşme ilişkisinin sona ermesini. Özellikle sezonluk veya birden çok tura yayılan çalışmalarda, "bu iş birlikteliğini nasıl bitiririz" sorusunun cevabı burada durur.

## Sık Yapılan Üç Hata

Birincisi, sözleşmeyi tur bittikten sonra hatırlamak. İmza, hizmetten önce anlam taşır; sonrasında yalnız bir kayıt belgesidir.

İkincisi, boş bırakılan maddeleri "sonra doldururuz" diye bırakmak. Yarım doldurulmuş bir metin, hiç olmayan metinden daha zayıftır: iki taraf da kendi anladığını yazılmış sanır. Bu araç tam da bu yüzden boş bıraktığınız opsiyonel alanların maddesini belgeden **tamamen çıkarır** — köşeli parantezli, boşluklu bir taslak üretmez.

Üçüncüsü, tek nüsha imzalamak. İki nüsha, iki tarafın da elinde aynı metnin bulunması demektir; tartışma çıktığında "bendeki sürüm farklı" cümlesini baştan siler.

## Bu Araç Ne Yapar, Ne Yapmaz

Bu araç, yukarıdaki maddeleri doldurduğunuz bilgilere göre birleştirip indirilebilir bir belge üretir. Boş bıraktığınız opsiyonel alanların maddeleri düşer, madde numaraları buna göre kayar. Belgenin içinde hem üstte hem altta, metnin bir **örnek iskelet** olduğu ve imzadan önce hukuk danışmanına gösterilmesi gerektiği yazılıdır.

Yapmadığı şey de açıktır: hukuki danışmanlık vermez, sizin ticari koşullarınızı bilemez ve mevzuatın güncel hâlini garanti etmez. Kendi turlarınıza, tedarikçi sözleşmelerinize ve çalışma düzeninize göre uyarlanması gerekir. Aynı disiplini müşteri tarafındaki metinler için de öneriyoruz — iptal ve iade politikanızı nasıl yazacağınızı [ayrı bir rehberde şablonuyla birlikte](/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir) anlattık.

Son olarak veri tarafı: doldurduğunuz hiçbir bilgi sunucumuza gitmez. Belge tamamen tarayıcınızda oluşturulur; biz ne saklarız ne de görürüz. Bunun pratik sonucu da şudur — sayfayı yenilerseniz form sıfırlanır. Uzun bir sözleşmeyi bölerek dolduracaksanız "Taslağı indir" seçeneğiyle bilgileri kendi bilgisayarınıza kaydedip sonra geri yükleyebilirsiniz.

## Sık Sorulan Sorular (SSS)

**1. Bu sözleşme hukuken geçerli mi?**
Araç, sektörde yaygın kullanılan madde başlıklarından oluşan bir örnek iskelet üretir. Bir metnin geçerliliği içeriğine, tarafların durumuna ve güncel mevzuata bağlıdır; bu yüzden imzalamadan önce kendi hukuk danışmanınıza inceletmenizi öneririz.

**2. Rehberin T.C. kimlik numarasını neden istemiyorsunuz?**
Sözleşmenin işlemesi için gerekli olmadığı gibi, gereksiz kişisel veri toplamak iyi bir uygulama değildir. Mesleki belge numarası yazmak isterseniz opsiyonel alan mevcut; boş bırakırsanız ilgili cümle belgeden çıkar.

**3. Boş bıraktığım alanlar belgede nasıl görünür?**
Görünmez. Opsiyonel bir alanı boş bırakırsanız o cümle veya madde belgeden tamamen düşer ve madde numaraları kayar. Köşeli parantezli veya altı çizili boşluklu bir taslak üretmiyoruz.

**4. Word yerine PDF alabilir miyim?**
Evet. "PDF olarak indir" düğmesi tarayıcınızın yazdırma penceresini açar; oradan "PDF olarak kaydet" seçeneğiyle belgeyi kaydedebilirsiniz. Word dosyası ise metni düzenlemek isteyenler için uygundur.

**5. Bilgilerim kaydediliyor mu?**
Hayır. Form verisi sunucuya gönderilmez, kaydedilmez ve tarafımızca görülmez; belge tamamen cihazınızda oluşturulur. Bunun karşılığı olarak sayfayı yenilediğinizde form sıfırlanır.

**6. Yarım kalan formu sonra tamamlayabilir miyim?**
"Taslağı indir" ile doldurduğunuz bilgileri kendi bilgisayarınıza küçük bir dosya olarak kaydedebilir, daha sonra "Taslak yükle" ile kaldığınız yerden devam edebilirsiniz. Dosya sizde kalır, bize hiçbir kopyası gelmez.

**7. Aynı sözleşmeyi birden çok rehber için kullanabilir miyim?**
Evet; belgeyi indirdikten sonra formda yalnız rehber bilgilerini değiştirip yeniden indirmeniz yeterli. Sık çalıştığınız rehberler için ayrı taslak dosyaları tutmak pratik bir yöntemdir.

**8. Sözleşmeyi ıslak imza olmadan kullanabilir miyim?**
Belgenin imza blokları ıslak imza için tasarlanmıştır. Elektronik imza veya kabul beyanı gibi yöntemlerin geçerliliği kullandığınız altyapıya ve mevzuata bağlıdır; bu konuda hukuk danışmanınızın görüşünü almanız yerinde olur.
`.trim();
