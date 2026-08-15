// ARAÇ-4 / kardeş-makale (SEO yüzeyi) — MARKDOWN tek kaynağı.
// ARAÇ-1/2 deseni: aynı metin hem ReactMarkdown ile render edilir hem de
// extractFaq() ile FAQPage şemasına dönüşür (tek-kaynak).
// HUKUKİ DİSİPLİN: uydurma yönetmelik madde-numarası veya oran YOK.

export const ARTICLE_MD = `
## Neden İki Ayrı Belge? Sözleşme ile Ön Bilgilendirme Formunun Farkı

Paket tur satan acentelerin en sık karıştırdığı konu şudur: "Sözleşme imzalattık, yeter." Oysa bu iki belge aynı işi yapmaz — biri satıştan **önce**, diğeri satış **anında** devreye girer ve ikisinin hukuki işlevi farklıdır.

**Ön bilgilendirme formu**, müşteri parayı ödemeden önce neyin satın alındığını anlatır: turun kapsamı, fiyata dahil olanlar ve olmayanlar, ödeme planı, iptal koşulları. İşlevi bilgilendirmedir — ve daha önemlisi, bilgilendirmenin **yapıldığını ispatlamaktır**. Bu yüzden formun en kritik parçası, çoğu acentenin atladığı son bölümdür: "bu form satıştan önce tüketiciye verilmiştir" beyanı, tarih ve imza.

**Satış sözleşmesi** ise tarafların karşılıklı hak ve yükümlülüklerini kurar: kim, neyi, hangi bedelle, hangi koşullarla. Anlaşmazlık çıktığında "ne anlaşmıştık" sorusunun cevabı buradadır.

Aradaki fark pratikte şöyle görünür: müşteri "bana hiç söylenmedi" dediğinde sizi koruyan şey sözleşme değil, tarihli ve imzalı ön bilgilendirme formudur. Sözleşme ise "söylendi ama farklı anlaşıldı" tartışmasını çözer. Biri olmadan diğeri eksik kalır.

## Hariç Listesi: Anlaşmazlıkların Ana Kaynağı

Tur sonrası yaşanan tartışmaların büyük kısmı turun kötü geçmesinden değil, **beklentinin yanlış kurulmasından** doğar. Müşteri müzenin dahil olduğunu sanmıştır; içeceklerin fiyata dahil olduğunu varsaymıştır; tek kişilik oda farkını duymamıştır.

Bunun çözümü "dahil olanlar" listesini uzatmak değildir — çünkü müşteri listede olmayan şeyi eksik saymaz, **dahil sanar**. Çözüm, hariç kalemleri **ayrı, açık ve vurgulu** bir başlık altında yazmaktır. Araçta bu yüzden hariç listesi ayrı bir madde olarak üretilir ve her iki belgede de "DAHİL OLMAYANLAR" başlığıyla görünür.

En sık unutulan kalemler bellidir: kişisel harcamalar, içecekler, programda belirtilmeyen müze girişleri, seyahat sigortası, tek kişilik oda farkı, bahşişler, opsiyonel turlar, vize ve harç işlemleri, sağlık giderleri. Araç bunları öneri olarak sunar; hiçbiri önceden işaretli değildir — hangisinin sizin turunuz için geçerli olduğuna siz karar verirsiniz.

## İptal Merdiveni: Tek Yerde Yazılır, İki Belgede Görünür

İptal-iade koşulları, hem satıştan önce bilgilendirme formunda görünmeli hem sözleşmede madde olarak yer almalıdır. İki belgeye ayrı ayrı yazıldığında kaçınılmaz olan şey olur: biri güncellenir, diğeri unutulur ve elinizde birbiriyle çelişen iki belge kalır. Çelişen belge, hiç belge olmamasından daha kötüdür.

Araç bu yüzden merdiveni **tek bir yerde** tutar: siz satırları bir kez doldurursunuz, sözleşmeye madde metni ve tablo olarak, ön bilgilendirme formuna ise özet tablo olarak işlenir. İkisinin farklı olması mimari olarak mümkün değildir.

Bir de kasıtlı bir eksiklik var: araç size hazır iade oranları **vermez**. Gün aralıklarını (30+ gün, 15-30 gün, 7-15 gün, 0-7 gün) örnek yapı olarak doldurabilirsiniz ama oran alanları boş gelir. Bunun sebebi basit — iade oranı sizin gerçek maliyet yapınıza, tedarikçi koşullarınıza ve tur tipinize bağlıdır; hazır bir tarife dağıtmak size yardım etmek değil, sizi tanımadığımız bir riske sokmak olurdu. Merdiveni nasıl kurgulayacağınızı ve hangi mantıkla gerekçelendireceğinizi [iptal-iade politikası rehberimizde](/blog/tur-iptal-ve-iade-politikasi-nasil-yazilir) ayrıntılı anlattık.

## Kapora ve Ödeme Planı Neden Belgeye Girmeli?

Sözlü konuşulan kapora, tahsilat sırasında değil iptal sırasında sorun çıkarır: "ben kapora değil, ön ödeme yaptım" cümlesi tanıdıktır. Belgede kaporanın tutarı, bakiyenin hangi tarihe kadar ödeneceği ve hangi kanalların kabul edildiği yazılıysa bu tartışma başlamaz bile.

Bir de sessiz bir fayda var: ödeme planını yazılı hâle getirmek tahsilat disiplinini de kurar. Vadesi yazılmamış bakiye, çoğu zaman kalkışa günler kala hatırlanır. Tahsilatın nakit akışına etkisini ve gecikmenin gerçek maliyetini [tahsilat ve müşteri takibi rehberimizde](/blog/acente-icin-crm-musteri-listesi-yeniden-satis) ele aldık.

## Bedeli Yazarken: Kişi Başı mı, Toplam mı?

"45.000" yazan bir belge, iki taraf için iki farklı anlam taşıyabilir. Bu yüzden araç bedeli tek biçimde yazmaz: girdiğiniz tutarın kişi başı mı toplam mı olduğunu seçersiniz, belgeye **ikisi birden** işlenir — "kişi başı X, 4 katılımcı için toplam Y". Tek cümlelik bu ayrıntı, iptal ve iade hesabında çıkacak tartışmayı baştan kapatır.

## Bu Araç Ne Yapar, Ne Yapmaz

Araç, tek bir formu doldurmanızla iki belgeyi birlikte üretir: paket tur satış sözleşmesi ve ön bilgilendirme formu. Boş bıraktığınız opsiyonel alanların madde ve satırları belgeden tamamen düşer, madde numaraları buna göre kayar. İki belgeyi ayrı ayrı Word olarak indirebilir veya tarayıcınızın yazdırma penceresinden PDF olarak kaydedebilirsiniz.

Yapmadığı şey açıktır: hukuki danışmanlık vermez. Ürettiği metinler sektörde yaygın madde başlıklarından oluşan **örnek iskeletlerdir**; mevzuatın güncel hâlini garanti etmez ve sizin özel ticari koşullarınızı bilemez. Her iki belgenin içinde de bu uyarı yazılıdır. İmzadan önce kendi hukuk danışmanınıza inceletin.

Veri tarafı diğer araçlarımızla aynı ilkeye bağlıdır: doldurduğunuz hiçbir bilgi sunucumuza gitmez, belgeler tamamen tarayıcınızda oluşturulur. Bunun karşılığı olarak sayfayı yenilerseniz form sıfırlanır; uzun bir formu bölerek doldurmak isterseniz "Taslağı indir" ile bilgileri kendi bilgisayarınıza kaydedip sonra geri yükleyebilirsiniz.

## Sık Sorulan Sorular (SSS)

**1. Sözleşme yeterli değil mi, ayrıca ön bilgilendirme formu şart mı?**
İkisi farklı işlev görür. Sözleşme tarafların yükümlülüklerini kurar; ön bilgilendirme formu ise satıştan önce bilgilendirme yapıldığını ispatlar. Anlaşmazlıkta "bana söylenmedi" savunmasına karşı sizi koruyan, tarihli ve imzalı olan ikincisidir.

**2. Ön bilgilendirme formunu ne zaman vermeliyim?**
Satış işlemi gerçekleşmeden önce. Formun hukuki değeri bu sıradan gelir; sözleşmeyle aynı anda imzalatılan bir form, "önceden bilgilendirme" işlevini büyük ölçüde kaybeder. Araç bu yüzden formun teslim tarihini ayrı bir alan olarak sorar.

**3. Formu WhatsApp'tan göndersem geçerli olur mu?**
Bilgilendirmenin kalıcı ve ispatlanabilir bir ortamda yapılması esastır; dijital iletim yaygın bir yöntemdir. Ancak hangi iletim biçiminin sizin satış kanalınız için yeterli sayılacağını hukuk danışmanınıza teyit ettirin.

**4. Müşterinin T.C. kimlik numarasını neden istemiyorsunuz?**
Belgenin işlemesi için gerekli değildir ve gereksiz kişisel veri toplamak iyi bir uygulama sayılmaz. Taraf kimliği ad-soyad ve iletişim bilgisiyle kurulur.

**5. Katılımcıların adlarını yazmak zorunda mıyım?**
Hayır, alan opsiyoneldir. Katılımcı sayısı ise zorunludur; çünkü bedel ve iptal hesabı bu sayıya dayanır. Ad yazmazsanız ilgili satır belgeden düşer.

**6. İade oranlarını neden siz önermiyorsunuz?**
Çünkü doğru oran sizin maliyet yapınıza, tedarikçi koşullarınıza ve tur tipinize bağlıdır. Hazır bir tarife vermek, tanımadığımız bir işletmeye onun için hesaplanmamış bir taahhüt yüklemek olurdu. Araç size yapıyı verir, rakamı siz koyarsınız.

**7. İki belgede iptal koşulları farklı olabilir mi?**
Bu araçta olamaz: merdiven tek yerde tutulur, iki belgeye de aynı kaynaktan işlenir. Belgeleri elle düzenlerseniz ikisini birlikte güncellemeye dikkat edin — çelişen iki belge, tek belgeden kötüdür.

**8. Belgeleri düzenleyebilir miyim?**
Evet. Word çıktısı düzenlenebilir biçimdedir; kendi maddelerinizi ekleyebilir, dilini değiştirebilirsiniz. Değişiklik sonrası metni yine hukuk danışmanınıza gösterin.

**9. Neden tek zip yerine iki ayrı dosya indiriliyor?**
Basitlik. İki belge çoğu zaman farklı anlarda kullanılır: form satıştan önce müşteriye gider, sözleşme satış anında imzalanır. Ayrı dosyalar bu akışa daha uygundur.

**10. Bedeli döviz olarak yazabilir miyim?**
Para birimi alanını serbestçe yazabilirsiniz. Ancak kur riskini ve tahsilatın hangi para biriminde yapılacağını belgede netleştirmeniz önerilir; bu araç kur dönüşümü yapmaz.

**11. Bilgilerim kaydediliyor mu?**
Hayır. Form verisi sunucuya gönderilmez, saklanmaz ve tarafımızca görülmez; belgeler tamamen cihazınızda oluşturulur. Sayfayı yenilediğinizde form sıfırlanır.

**12. Aynı belgeleri farklı turlar için tekrar kullanabilir miyim?**
Evet. "Taslağı indir" ile acente bilgilerinizi ve standart madde tercihlerinizi kaydedip her yeni turda geri yükleyebilir, yalnız tura özel alanları değiştirebilirsiniz.

---

*Bu araç ve ürettiği belgeler bilgilendirme amaçlıdır; hukuki danışmanlık yerine geçmez. Kullanmadan önce güncel mevzuata göre avukatınıza inceletin. İlgili mevzuat hükümleri saklıdır.*
`;
