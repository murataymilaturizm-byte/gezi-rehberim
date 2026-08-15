// ARAÇ-2 / kardeş-makale (SEO yüzeyi) — MARKDOWN tek kaynağı.
// ARAÇ-1 deseni: aynı metin hem ReactMarkdown ile render edilir hem de
// blog-anatomy'deki extractFaq() ile FAQPage şemasına dönüşür (tek-kaynak).
// SSS biçimi M-serisiyle AYNI: "## Sık Sorulan Sorular (SSS)" + **kalın-paragraf** soru.
//
// İÇERİK KURALI: uydurma sektör-oranı YASAK. Metinde "acentelerin %70'i" gibi
// kaynaksız istatistik yoktur; yalnız aritmetik olarak doğrulanabilir örnekler var.

export const ARTICLE_MD = `
## Tur Fiyatı Nasıl Hesaplanır? Sabit ve Değişken Gider Ayrımı

Tur fiyatlamasında en sık yapılan hata, bütün giderleri tek bir torbaya atıp kişi sayısına bölmektir. Oysa tur maliyeti iki farklı davranışa sahip iki gruptan oluşur ve bu ikisini ayırmadan verilen her fiyat, aslında bir tahmindir.

**Sabit giderler** kişi sayısından bağımsızdır: otobüs kirası, rehber ücreti, şoförün konaklama ve yemeği, park-geçiş-köprü ücretleri. Araçta 12 kişi de olsa 40 kişi de olsa bu kalemler değişmez. **Değişken giderler** ise her yolcuyla birlikte artar: müze girişi, yemek, konaklama, sigorta.

Bu ayrımın pratik sonucu şudur: **kişi başı maliyetiniz sabit bir sayı değildir.** Doluluk arttıkça sabit giderler daha çok kişiye bölünür ve kişi başı maliyet düşer. Aynı turun kişi başı maliyeti 22 kişide bambaşka, 38 kişide bambaşkadır. "Turun maliyeti kişi başı şu kadar" cümlesi, hangi dolulukta olduğunu söylemeden anlamsızdır.

## Son Koltuklar Neden Kârın Büyük Kısmını Taşır?

Somut bir örnekle bakalım. 45 koltuklu bir araçla günübirlik tur düzenlediğinizi varsayalım: sabit giderleriniz toplam 18.300 TL (araç 12.000, rehber 4.000, şoför 1.500, park-geçiş 800), kişi başı değişken gideriniz 800 TL (müze 400, yemek 350, sigorta 50). Kişi başına 1.750 TL'den sattığınızı düşünelim.

| Doluluk | Kişi | Toplam gelir | Toplam maliyet | Kâr |
|---|---|---|---|---|
| %50 | 22 | 38.500 | 35.900 | 2.600 |
| %70 | 31 | 54.250 | 43.100 | 11.150 |
| %85 | 38 | 66.500 | 48.700 | 17.800 |
| %100 | 45 | 78.750 | 54.300 | 24.450 |

Tabloyu dikkatle okuyun: yolcu sayısı iki katına çıkmıyor ama kâr neredeyse on katına çıkıyor. Sebep basit — her yeni yolcu size yalnız 800 TL'ye mal oluyor ama 1.750 TL getiriyor; aradaki 950 TL'lik fark, önce sabit giderleri kapatmaya, o kapandıktan sonra ise doğrudan kâra gidiyor.

İşte "son koltuklar kârı taşır" cümlesinin aritmetiği budur. Ve aynı aritmetik ters yönde de çalışır: yarı dolu giden bir tur, iptal edilmediği için kurtulmuş sayılmaz — sadece kârın çoğundan vazgeçmiş olursunuz.

## Başabaş Noktası: Turun Gerçek Eşiği

Başabaş, gelirin maliyeti tam karşıladığı kişi sayısıdır. Yukarıdaki örnekte her yolcunun sabit giderlere katkısı 950 TL (1.750 − 800). Sabit gider 18.300 TL olduğuna göre başabaş noktası 18.300 ÷ 950 ≈ 19,3 — yani **20 kişi.** 19 kişide 250 TL zarar, 20 kişide 700 TL kâr edersiniz.

Bu tek sayı, sezon boyunca vereceğiniz kararların çoğunu sadeleştirir: kalkış kararını, indirim sınırını, hangi turu programdan çıkaracağınızı. Başabaş noktanız kapasitenizin çok yakınındaysa — diyelim 45 koltukta 40 kişi — o tur yapısal olarak risklidir; sıradan bir doluluk dalgalanması sizi zarara geçirir.

Bir de sessiz tuzak var: satış fiyatınız kişi başı değişken giderin altındaysa başabaş noktası **yoktur**. O durumda doluluk arttıkça zarar da artar. Kulağa uzak ihtimal gibi gelir ama indirim üstüne indirim yapılan son dakika satışlarında gerçekten karşılaşılır.

## Kâr Marjı mı, Maliyet Üstü Kâr mı?

"%30 kâr istiyorum" cümlesi iki farklı hesap anlamına gelir ve ikisi farklı fiyat üretir:

- **Maliyet üzerine kâr (markup):** maliyet × 1,30. 100 TL maliyet → 130 TL fiyat.
- **Satıştan kâr payı (marj):** maliyet ÷ 0,70. 100 TL maliyet → 142,86 TL fiyat.

İkisi de geçerlidir, ikisi de sektörde kullanılır — ama hangisini kullandığınızı bilmeden fiyat vermek, kârınızı tesadüfe bırakmaktır. Hesaplayıcıda bu seçim size bırakılmıştır; hangi formülün uygulandığı ekranda görünür.

## Komisyonu Fiyata Katmayı Unutmayın

Turu bir aracı, platform veya partner acente üzerinden satıyorsanız, komisyon ne sabit gider ne kişi başı giderdir — **satış fiyatının yüzdesidir.** Bu yüzden maliyetin üstüne kâr koyup fiyatı belirledikten sonra komisyonu "içinden" düşerseniz hedeflediğiniz kâra ulaşamazsınız.

Doğru sıra şudur: önce maliyet üstüne kârınızı koyup size kalması gereken net tutarı bulun, sonra komisyonu bu tutarın üstüne ekleyerek liste fiyatını hesaplayın. Aksi hâlde her komisyonlu satışta, fark ettiğinizden daha az kazanırsınız. Nakit akışı tarafında da benzer bir sessiz sızıntı vardır; tahsilat gecikmelerinin işletmeye maliyetini [tahsilat ve nakit akışı rehberimizde](/blog/acente-icin-crm-musteri-listesi-yeniden-satis) ayrıca ele aldık.

## Sermaye ile Kârı Karıştırmamak

Yeni acentelerin en pahalı hatalarından biri, kasadaki parayı kâr sanmaktır. Tur öncesinde tahsil edilen kaporalar kasaya girer ama o para henüz kazanılmış değildir: araç, rehber, müze ve yemek ödemeleri henüz yapılmamıştır. Bu rehberde anlatılan hesabın asıl faydası da budur — kasadaki tutara değil, **turun kendi aritmetiğine** bakmayı öğretir. Acente kurarken yapılan bu ve benzeri hataları [acente açarken yapılan 10 hata yazımızda](/blog/acente-acarken-yapilan-10-hata) tek tek ele aldık.

## Bu Araç Ne Yapar, Ne Yapmaz

Hesaplayıcı, girdiğiniz sabit ve değişken giderlerden kişi başı maliyeti çıkarır, seçtiğiniz kâr yöntemine göre bir satış fiyatı önerir ve o fiyatla dört farklı doluluk senaryosunda ne kazanacağınızı gösterir. Kendi fiyatınız varsa "fiyatımı test et" moduna geçip aynı tabloyu kendi rakamınızla görebilirsiniz.

Yapmadığı şeyler de net: mali müşavirlik yapmaz, sizin vergi durumunuzu bilemez ve KDV indirim mekanizmasını modellemez — maliyetleri KDV hariç girmeniz, KDV'yi yalnız satış fiyatı görünümü olarak kullanmanız beklenir. Kur dönüşümü de yapmaz; para birimi seçimi yalnız etikettir.

Veri tarafı ARAÇ-1 ile aynı ilkeye bağlıdır: girdiğiniz hiçbir rakam sunucumuza gitmez, hesap tamamen tarayıcınızda yapılır. Bunun pratik sonucu şudur — sayfayı yenilerseniz form sıfırlanır. Hesabınızı saklamak veya bir meslektaşınıza göstermek isterseniz "Hesabı link olarak kopyala" düğmesini kullanabilirsiniz; bu durumda maliyet yapınız linkin içinde taşınır, dolayısıyla linki yalnız güvendiğiniz kişilerle paylaşın.

## Sık Sorulan Sorular (SSS)

**1. Kişi başı maliyet neden sabit bir sayı değil?**
Çünkü sabit giderler (araç, rehber, şoför) kişi sayısına bölünür. 45 koltuklu araçta 22 kişiyle giderseniz sabit giderin kişi başına düşen payı, 38 kişiyle gitmenize göre çok daha yüksektir. Kişi başı maliyet ancak bir doluluk varsayımıyla birlikte anlamlıdır.

**2. Hangi doluluğa göre fiyat vermeliyim?**
Gerçekçi olarak ulaşabildiğiniz ortalama doluluğa göre. Çok iyimser bir doluluk seçerseniz fiyatınız düşük çıkar ve normal turlarda zarar edersiniz; çok kötümser seçerseniz fiyatınız rekabetçi olmaz. Hesaplayıcının varsayılanı %70'tir; kendi geçmiş verinize göre değiştirin.

**3. Neden her doluluk için ayrı fiyat önermiyorsunuz?**
Çünkü gerçek hayatta tek fiyat ilan edilir, doluluk sonradan belli olur. Bu yüzden araç tek bir önerilen fiyat verir ve o fiyatla farklı dolulukların sonucunu gösterir — karar akışı böyle işler.

**4. Markup ile marj arasındaki fark neden önemli?**
Aynı yüzde farklı fiyat üretir: 100 TL maliyette %30 markup 130 TL, %30 marj 142,86 TL'dir. Hangisini kullandığınızı bilmezseniz hedeflediğiniz kâra ulaşıp ulaşmadığınızı da bilemezsiniz.

**5. KDV'yi nasıl girmeliyim?**
Maliyetleri KDV hariç girin. Araç, KDV'yi yalnız satış fiyatı görünümü olarak hesaplar ve size hem KDV hariç hem KDV dahil fiyatı gösterir. Girdi maliyetlerindeki KDV indirimi bu araçta modellenmez; o konuda mali müşavirinize danışın.

**6. Komisyonu nereye yazmalıyım?**
Komisyon alanına yüzde olarak. Araç, size kalması gereken net tutarı koruyacak biçimde liste fiyatını yukarı ayarlar. Komisyonsuz çalışıyorsanız alanı boş bırakın — boş bırakılan alan hesaptan tamamen düşer.

**7. Başabaş noktası kapasitemden büyük çıkıyor, ne demek bu?**
O fiyatla tur tamamen dolsa bile maliyetinizi kurtaramıyorsunuz demektir. Fiyatı yükseltmeniz, sabit gideri düşürmeniz (daha küçük araç) veya o turu programdan çıkarmanız gerekir.

**8. "Doluluk arttıkça zarar büyür" uyarısını aldım, neden?**
Satış fiyatınız kişi başı değişken giderin altında kaldığı için. Her yeni yolcu size kazandırdığından fazlasına mal oluyor. Bu durumda başabaş noktası yoktur; fiyatı gözden geçirmelisiniz.

**9. Çocuk indirimi veya farklı fiyat kademelerini hesaplayabilir miyim?**
Bu sürümde hayır — araç tek fiyat üzerinden çalışır. Karma fiyatlı bir tur için pratik yöntem, ortalama satış fiyatınızı "fiyatımı test et" moduna girip senaryo tablosunu o rakamla okumaktır.

**10. Farklı para birimlerinde hesap yapabilir miyim?**
Para birimi seçimi yalnız etikettir; kur dönüşümü yapılmaz. Tüm rakamları aynı para biriminde girmeniz gerekir, aksi hâlde sonuç anlamsız olur.

**11. Girdiğim rakamlar saklanıyor mu?**
Hayır. Hesap tamamen cihazınızda yapılır, hiçbir veri sunucuya gönderilmez. Sayfayı yenilediğinizde form sıfırlanır; saklamak isterseniz "Hesabı link olarak kopyala" ile kendinize bir link üretebilirsiniz.

**12. Sonucu nasıl kaydederim veya paylaşırım?**
"Sonucu indir" düğmesi tarayıcınızın yazdırma penceresini açar; oradan PDF olarak kaydedebilirsiniz. Hesabın kendisini paylaşmak isterseniz link kopyalama seçeneğini kullanın — ancak maliyet yapınızın linkte göründüğünü unutmayın.

---

*Bu araç bilgilendirme amaçlıdır ve mali müşavirlik yerine geçmez. Vergi, KDV ve muhasebe konularında kendi mali müşavirinize danışın.*
`;
