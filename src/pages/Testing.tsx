import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import TestRunner from '@/components/TestRunner';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Testing() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Test Automation</h1>
        <p className="text-muted-foreground">
          Demo ve WhatsApp entegrasyonlarının paritesini otomatik test edin
        </p>
      </div>

      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Nasıl Kullanılır?</AlertTitle>
        <AlertDescription>
          <div className="space-y-3 mt-2">
            <div>
              <p className="font-semibold mb-1">🎭 Seçenek 1: Mock Data ile Test (Önerilen - En Kolay)</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>🎭 Mock Data ile Test butonuna tıklayın</li>
                <li>Örnek verilerle tüm testler otomatik çalışacaktır</li>
                <li>Hiçbir konuşma yapmanıza gerek yoktur</li>
              </ol>
            </div>
            
            <div>
              <p className="font-semibold mb-1">🚀 Seçenek 2: Gerçek Verilerle Test</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Demo chat'te ve WhatsApp'ta konuşmalar yapın</li>
                <li>"Gerçek Verilerle Otomatik Test" butonuna tıklayın</li>
                <li>Sistem en son konuşmalarınızı otomatik bulup test edecektir</li>
              </ol>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <TestRunner />

      <Card>
        <CardHeader>
          <CardTitle>📖 Test Kategorileri</CardTitle>
          <CardDescription>Bu test suite şunları kontrol eder:</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">🧠 Memory Extraction</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Memory yapısı varlığı</li>
                <li>Destinasyon hafızası</li>
                <li>İlgi alanı extraction</li>
                <li>Pax (katılımcı) extraction</li>
                <li>Bütçe aralığı detection</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">💬 Conversation State</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Stage tracking (initial → booking)</li>
                <li>Wizard state management</li>
                <li>Conversation flow history</li>
                <li>Current tour tracking</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">🎯 Profile Insights</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Topics discussed logging</li>
                <li>Questions asked tracking</li>
                <li>Sentiment signals (positive/negative)</li>
                <li>Conversation insights enrichment</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">✅ Wizard Flow</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Registration creation (WhatsApp)</li>
                <li>Price calculation accuracy</li>
                <li>Step-by-step flow</li>
                <li>State persistence</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🔗 İlgili Dokümantasyon</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>
              <a href="/TEST_SCENARIOS.md" className="text-primary hover:underline" target="_blank">
                📄 TEST_SCENARIOS.md - Manuel test senaryoları
              </a>
            </li>
            <li>
              <a href="/WHATSAPP_RESERVATION_WIZARD.md" className="text-primary hover:underline" target="_blank">
                📄 WHATSAPP_RESERVATION_WIZARD.md - Wizard dokümantasyonu
              </a>
            </li>
            <li>
              <a href="/WHATSAPP_SETUP.md" className="text-primary hover:underline" target="_blank">
                📄 WHATSAPP_SETUP.md - WhatsApp kurulum kılavuzu
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
