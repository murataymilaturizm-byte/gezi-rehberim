// ARAÇ-6 / kardeş-makale — MARKDOWN tek kaynağı.
// extractFaq() ile FAQPage şemasına dönüşür (ARAÇ-1/2/4/5 deseni).
// İÇERİK KURALI: uydurma sektör-oranı ve uydurma yönetmelik madde-no YASAK.

export const ARTICLE_MD = `
## Taşıma Anlaşmasını Yazılı Yapmak Neyi Değiştirir?

Tur operasyonunda otobüs, acentenin en pahalı ve en kırılgan halkasıdır. Pahalı, çünkü sabit giderlerin en büyüğüdür. Kırılgan, çünkü tek bir arıza bütün turu durdurur — rehber gelmiş, misafirler buluşma noktasında beklemektedir ve elinizde bir telefon numarası vardır.

Sektörde taşıma anlaşmalarının çoğu sözlüdür: "sezon boyunca senin otobüsünle çalışırız", "cumartesi sabah 07.00'de kapıda olur". İşler yolunda gittiğinde bu düzenin sorunu görünmez. Sorun, arıza sabahında ortaya çıkar — ve o sabah tartışılan şey, aslında aylar önce konuşulmamış olan şeydir: **araç gelmezse ne olacak?**

Yazılı sözleşmenin işlevi taşıyıcıya güvenmemek değildir. İşlevi, kriz gününün kararlarını kriz gününden önce vermektir. O gün ikame araç arayan acente ile sözleşmesinde ikame yükümlülüğü yazan acente, aynı arızayı yaşar ama farklı sonuç alır.

## İkame Araç Maddesi: Belgenin Kalbi

Bir taşıma sözleşmesinde tek madde okunacaksa bu olmalıdır. İkame araç maddesi, aracın hizmeti sağlayamaz duruma gelmesi hâlinde taşıyıcının yerine araç temin etme yükümlülüğünü kurar. Yazılmadığında ne olur? Hukuken hiçbir şey kendiliğinden yok olmaz, ama pratikte tartışma başlar: taşıyıcı "elimde başka araç yok" der, acente "turu ben iptal edemem" der, ve konuşma çözüm üretmeden uzar.

İyi yazılmış bir ikame maddesi üç şeyi netleştirir:

**Süre.** "En kısa sürede" ifadesi iyi niyetlidir ama ölçülemez. Saat yazmak — örneğin iki saat — tartışmayı bitirir. Süreyi belirlerken gerçekçi olun: taşıyıcının filosu ve mesafesi neye izin veriyorsa o yazılmalı; tutamayacağı bir süreyi imzalayan taşıyıcı, o günü yine tartışmayla geçirir.

**Kapasite.** İkame aracın **eşdeğer veya üst nitelikte** olması gerektiği yazılmalıdır. Aksi hâlde 45 kişilik grup için 27 kişilik minibüs gelir ve teknik olarak "ikame araç temin edilmiş" olur.

**Bildirim.** Taşıyıcının, aracın çalışmadığını öğrendiği anda acenteyi haberdar etme yükümlülüğü. En pahalı gecikme, arızanın acenteye buluşma saatinde öğretilmesidir.

Bu madde, [acente açarken yapılan hatalar yazımızda](/blog/acente-acarken-yapilan-10-hata) anlattığımız yedinci hatanın — tedarikçi zincirini tek ağıza bağlamak — yazılı panzehiridir. Sözleşme B planının yerine geçmez; ama B planını taşıyıcının yükümlülüğü hâline getirir.

## Sefer Başına mı, Sezonluk Dönem mi?

İki çalışma biçiminin ekonomisi ve riski farklıdır.

**Sefer başına anlaşma**, esnekliktir. Her sefer ayrı fiyatlanır, taahhüt yoktur, düşük sezonda ödeme yapmazsınız. Karşılığında sezonun en dolu haftasında araç bulma riski sizdedir — ve o hafta fiyatlar da en yüksektir.

**Sezonluk dönem anlaşması**, öngörülebilirliktir. Fiyat baştan sabitlenir, araç tahsisi güvenceye alınır, taşıyıcı da hacim gördüğü için daha iyi fiyat verir. Karşılığında doluluk beklediğiniz gibi gelmezse ödeme yükümlülüğü sürer.

Doğru seçim, doluluk öngörünüzün ne kadar sağlam olduğuna bağlıdır. Geçmiş sezon verisi olan acente dönem anlaşmasından kazanır; ilk sezonunu geçiren acente sefer başına çalışıp veri toplamalıdır. Bu kararın maliyet tarafını [tur kâr ve fiyat hesaplayıcımızla](/araclar/tur-kar-hesaplayici) test edebilirsiniz: araç kirası sabit gider olduğu için, dönem anlaşmasının kişi başı maliyete etkisi doluluğa göre ciddi biçimde değişir.

Dönem anlaşmasında bir ayrıntı çoğu zaman atlanır: **fesih bildirimi**. Sezon ortasında yollar ayrılabilir; kaç gün önceden haber verileceği yazılıysa bu ayrılık operasyonu vurmaz. Bir de fesih sonrası hâli düşünün — bildirimden önce satışı yapılmış seferlerin yerine getirilmesi gerektiği yazılmalıdır, yoksa satılmış turlar havada kalır.

## Masrafları Kim Karşılıyor?

Taşıma anlaşmalarında en sık yaşanan gerilim bedelde değil masraftadır: yakıt, köprü ve otoyol geçişleri, otopark, şoförün konaklama ve yemeği. Bu kalemler konuşulmadığında herkes kendi lehine varsayar.

Doğru yöntem, her kalemi tek tek işaretlemektir. Bu araç bu yüzden dört kalemi ayrı ayrı sorar ve yalnız işaretlediklerinizi belgeye tablo olarak yazar; belirtmediğiniz kalem belgeye hiç girmez. Boş bırakmayı tercih ediyorsanız bunu bilinçli yapın — sözleşmede yazmayan masraf, sahada karşınıza çıkar.

## Sigorta Beyanı Neden Önemli?

Taşıma faaliyetinde araçların taşıdığı zorunlu sigortalar, bir aksaklık hâlinde ilk devreye girecek güvencedir. Sözleşmeye taşıyıcının bu sigortaların geçerli olduğuna dair beyanını ve talep hâlinde poliçe bilgilerini ibraz edeceğini yazmak iki iş görür: taşıyıcı tarafında bir özen yükümlülüğü kurar, acente tarafında ise misafire karşı sorumluluğunuzu yönetilebilir kılar.

Hangi sigortaların hangi taşıma türü için zorunlu olduğu mevzuata ve araç sınıfına göre değişir; bu belge o belirlemeyi yapmaz, yalnız beyanı kayda geçirir. Ayrıntıyı kendi hukuk ve mali danışmanınıza teyit ettirin.

## Bu Araç Ne Yapar, Ne Yapmaz

Araç, formu doldurmanızla acente ile taşıma firması arasındaki hizmet sözleşmesinin örnek iskeletini üretir. İki çalışma biçimini destekler: tek sefer ve sezonluk dönem. Seçtiğiniz moda göre tarih alanları, bedel hesaplama biçimi ve fesih maddesi birlikte değişir — iki mod aynı belgede karışmaz. Boş bıraktığınız opsiyonel alanların madde ve satırları belgeden tamamen düşer, madde numaraları kayar.

Yapmadığı şey açıktır: hukuki danışmanlık vermez, hangi yetki belgesinin sizin taşıma türünüz için zorunlu olduğunu belirlemez ve mevzuatın güncel hâlini garanti etmez. Belgenin içinde bu uyarı yazılıdır. İmzadan önce kendi hukuk danışmanınıza inceletin.

Veri tarafı diğer araçlarımızla aynı ilkeye bağlıdır: doldurduğunuz hiçbir bilgi sunucumuza gitmez, belge tamamen tarayıcınızda oluşturulur. Sayfayı yenilerseniz form sıfırlanır; "Taslağı indir" ile bilgileri kendi bilgisayarınıza kaydedip sonra geri yükleyebilirsiniz.

## Sık Sorulan Sorular (SSS)

**1. Taşıma anlaşmasını yazılı yapmak zorunda mıyım?**
Bu araç zorunluluk belirlemez; ticari ilişkilerde yazılı düzenin ispat kolaylığı sağladığı genel bir gerçektir. Sizin faaliyetiniz için hangi biçim şartlarının geçerli olduğunu hukuk danışmanınıza sorun.

**2. İkame araç süresini kaç saat yazmalıyım?**
Taşıyıcının filosu ve mesafesinin gerçekçi izin verdiği kadar. Tutulamayacak bir süre yazmak, o günü yine tartışmayla geçirmek anlamına gelir. Süre yazmazsanız madde "hizmetin aksamasını önleyecek en kısa süre" ifadesiyle basılır.

**3. İkame araç eşdeğer olmak zorunda mı?**
Sözleşmeye yazarsanız evet. Yazmazsanız, kapasitesi düşük bir araç da teknik olarak "ikame" sayılabilir. Bu araçta eşdeğer kapasite şartı varsayılan olarak işaretlidir; kaldırabilirsiniz.

**4. Sefer başına mı dönemlik mi çalışmak daha iyi?**
Doluluk öngörünüzün sağlamlığına bağlıdır. Geçmiş sezon veriniz varsa dönem anlaşması genellikle daha iyi fiyat ve araç güvencesi getirir; ilk sezonunuzdaysanız sefer başına çalışıp veri toplamak daha az risklidir.

**5. Dönem anlaşmasında fesih maddesi neden gerekli?**
Sezon ortasında yollar ayrılabilir. Kaç gün önceden bildirim yapılacağı yazılıysa ayrılık operasyonu vurmaz. Ayrıca bildirimden önce satılmış seferlerin yerine getirilmesi gerektiği yazılmalıdır; yoksa satılmış turlar havada kalır.

**6. Yakıt kime ait olmalı?**
Sektörde her iki uygulama da görülür; doğru cevap sizin fiyatlama biçiminize bağlıdır. Önemli olan hangisi olduğunun yazılı olmasıdır — yazılmayan masraf kalemi, sahada tartışma üretir.

**7. Şoförün konaklama ve yemeği kimin sorumluluğunda?**
Bu da anlaşmaya bağlıdır ve sıklıkla atlanır. Araç bu kalemi ayrı satır olarak sorar; işaretlemezseniz belgede hiç görünmez.

**8. Taşıyıcının yetki belgesi numarasını yazmak zorunlu mu?**
Alan opsiyoneldir. Hangi yetki belgesinin sizin taşıma türü için gerekli olduğu mevzuata ve araç sınıfına göre değişir; araç bu belirlemeyi yapmaz. Belgeyi kayda geçirmek isterseniz alanı doldurun.

**9. Birden fazla araç yazabilir miyim?**
Evet, araç satırı ekleyerek. Belgede araçlar tablo olarak listelenir; tek araçta da tek satırlık tablo basılır. Araç bilgisi girmezseniz o madde belgeye hiç girmez.

**10. Şoför bilgisi yazmak şart mı?**
Hayır, opsiyoneldir. Yazarsanız belgeye bir madde olarak girer ve taşıyıcının şoför belgelerine ilişkin beyanı da eklenir. T.C. kimlik numarası istemiyoruz — belgenin işlemesi için gerekli değil.

**11. Bilgilerim kaydediliyor mu?**
Hayır. Form verisi sunucuya gönderilmez, saklanmaz ve tarafımızca görülmez; belge tamamen cihazınızda oluşturulur. Sayfayı yenilediğinizde form sıfırlanır.

**12. Aynı sözleşmeyi farklı taşıyıcılar için kullanabilir miyim?**
Evet. "Taslağı indir" ile acente bilgilerinizi ve standart koşul tercihlerinizi kaydedip her yeni taşıyıcıda geri yükleyin, yalnız taşıyıcıya özel alanları değiştirin.

---

*Bu araç ve ürettiği belge bilgilendirme amaçlıdır; hukuki danışmanlık yerine geçmez. Kullanmadan önce güncel mevzuata göre avukatınıza inceletin. İlgili mevzuat hükümleri saklıdır.*
`;
