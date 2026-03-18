import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, UserCheck, Database, AlertTriangle, Mail } from "lucide-react";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>

        <h1 className="text-3xl font-bold mb-2">Kullanım Şartları</h1>
        <p className="text-muted-foreground mb-8">
          Son güncelleme: {new Date().toLocaleDateString("tr-TR")}
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Hizmetin Tanımı
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <p>
                Turzz AI, tur ve seyahat acentelerinin WhatsApp üzerinden müşterileriyle
                otomatik iletişim kurmasını sağlayan yapay zeka destekli bir platformdur.
              </p>
              <p>
                Platform; tur tanıtımı, rezervasyon yönetimi, hatırlatma mesajları,
                müşteri desteği ve ödeme takibi gibi hizmetleri kapsar.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="h-5 w-5 text-primary" />
                Kullanıcı Yükümlülükleri
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Platforma doğru ve güncel bilgiler sağlamakla yükümlüsünüz.</li>
                <li>Hesap bilgilerinizin güvenliğinden siz sorumlusunuz.</li>
                <li>Platformu yasa dışı veya yetkisiz amaçlarla kullanamazsınız.</li>
                <li>WhatsApp Business politikalarına ve Meta kurallarına uymakla yükümlüsünüz.</li>
                <li>Müşterilerinizin kişisel verilerini koruma sorumluluğu size aittir.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-primary" />
                Veri Kullanımı
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <p>
                Turzz AI, hizmet sunumu için gerekli verileri toplar ve işler. Bu veriler
                şunları içerebilir: acente bilgileri, tur detayları, müşteri iletişim
                bilgileri ve mesaj içerikleri.
              </p>
              <p>
                Verileriniz güvenli sunucularda saklanır ve üçüncü taraflarla
                yalnızca hizmet gereklilikleri doğrultusunda (WhatsApp Business API vb.)
                paylaşılır. Detaylı bilgi için{" "}
                <a href="/privacy-policy" className="text-primary underline hover:text-primary/80">
                  Gizlilik Politikamızı
                </a>{" "}
                inceleyebilirsiniz.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Hizmet Kesintisi ve Sorumluluk Reddi
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <p>
                Turzz AI, hizmeti "olduğu gibi" sunar. Planlı bakım, teknik
                arızalar veya üçüncü taraf hizmet sağlayıcılarından (Meta, WhatsApp vb.)
                kaynaklanan kesintilerden dolayı sorumluluk kabul etmez.
              </p>
              <p>
                Platform, hizmet kalitesini artırmak amacıyla özelliklerde değişiklik
                yapma hakkını saklı tutar. Önemli değişiklikler önceden bildirilir.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                İletişim
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <p>Kullanım şartları hakkında sorularınız için bizimle iletişime geçebilirsiniz:</p>
              <p className="mt-2 font-medium text-foreground">info@turzz.com</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground mt-8 text-center">
          Bu kullanım şartları Aymila Bilgisayar İtriyat Turizm İthalat İhracat Ticaret ve Sanayi Limited Şirketi
          tarafından işletilen Turzz AI platformunu kullanan tüm acenteler ve kullanıcılar için geçerlidir.
        </p>
      </div>
    </div>
  );
};

export default TermsOfService;
