import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Database, Share2, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>

        <h1 className="text-3xl font-bold mb-2">Gizlilik Politikası</h1>
        <p className="text-muted-foreground mb-8">
          Son güncelleme: {new Date().toLocaleDateString("tr-TR")}
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-primary" />
                Topladığımız Veriler
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <p>Hizmetlerimizi sunabilmek için aşağıdaki kişisel verileri topluyoruz:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Ad ve soyad bilgileri</li>
                <li>Telefon numarası</li>
                <li>WhatsApp üzerinden gönderilen mesaj içerikleri</li>
                <li>Tur tercihleri ve rezervasyon bilgileri</li>
                <li>Dil ve para birimi tercihleri</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Verileri Nasıl Kullanıyoruz
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <p>Topladığımız veriler yalnızca aşağıdaki amaçlarla kullanılmaktadır:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Tur rezervasyonlarının oluşturulması ve yönetimi</li>
                <li>Tur hatırlatma mesajlarının gönderilmesi</li>
                <li>Müşteri destek hizmetlerinin sağlanması</li>
                <li>Hizmet kalitesinin iyileştirilmesi</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Share2 className="h-5 w-5 text-primary" />
                Üçüncü Taraflarla Paylaşım
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <p>
                WhatsApp üzerinden iletişim sağlamak amacıyla mesajlarınız Meta
                (WhatsApp Business API) altyapısı üzerinden iletilmektedir. Bunun
                dışında kişisel verileriniz üçüncü taraflarla paylaşılmamaktadır.
              </p>
              <p>
                Ödeme işlemleri güvenli ödeme altyapı sağlayıcıları aracılığıyla
                gerçekleştirilir; kart bilgileriniz tarafımızca saklanmaz.
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
              <p>
                Gizlilik politikamız hakkında sorularınız için bizimle iletişime
                geçebilirsiniz:
              </p>
              <p className="mt-2 font-medium text-foreground">
                info@turzzai.com
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground mt-8 text-center">
          Bu gizlilik politikası TURZZ AI platformunu kullanan acenteler ve
          müşterileri için geçerlidir.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
