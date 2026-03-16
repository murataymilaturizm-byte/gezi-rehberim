import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const SuperAdminWhatsAppSettings = () => {
  const { toast } = useToast();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          360Dialog WhatsApp Ayarları
        </CardTitle>
        <CardDescription>
          360Dialog API üzerinden WhatsApp entegrasyonu yönetimi
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            360Dialog entegrasyonu acente bazlıdır. Her acente kendi WhatsApp Business numarasını
            360Dialog üzerinden bağlar ve kendi API anahtarını alır. 
            <ul className="mt-2 space-y-1">
              <li>• Her acentenin kendi <strong>D360-API-KEY</strong>'i olur</li>
              <li>• Acenteler dashboard'dan "WhatsApp Bağla" butonuyla numaralarını bağlar</li>
              <li>• Webhook URL: <code className="text-xs bg-muted px-1 rounded">https://ncuswacwpqcxhmlhvfgq.supabase.co/functions/v1/whatsapp-webhook</code></li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">📋 360Dialog Kurulum Adımları</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>360Dialog Partner hesabı oluşturun</li>
              <li>Partner ID'nizi alın</li>
              <li>Webhook URL'ini 360Dialog panelinden ayarlayın</li>
              <li>Acenteler "WhatsApp Bağla" butonuyla numaralarını bağlasın</li>
            </ol>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">📝 Önemli Notlar</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Telefon numaraları "+" olmadan, ülke kodu ile başlar: 905xxxxxxxxx</li>
              <li>• 24 saat kuralı: Son mesajdan 24 saat geçtiyse template mesajı gönderin</li>
              <li>• Webhook URL'inde alt çizgi (_) kullanmayın</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
