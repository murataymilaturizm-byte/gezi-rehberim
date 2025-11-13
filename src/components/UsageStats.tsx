import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Calendar, Database, TrendingUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UsageData {
  monthly_message_count: number;
  message_limit: number;
  plan_type: string;
  last_message_reset_date: string;
  subscription_status: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
}

export const UsageStats = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('agencies')
        .select('monthly_message_count, message_limit, plan_type, last_message_reset_date, subscription_status, trial_ends_at, subscription_ends_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      // Super admin veya agency'si olmayan kullanıcılar için
      if (!data) {
        setUsage(null);
        setLoading(false);
        return;
      }
      
      setUsage(data);
    } catch (error) {
      console.error('Error loading usage data:', error);
      toast({
        title: "Hata",
        description: "Kullanım bilgileri yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Paket Kullanımı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Yükleniyor...</div>
        </CardContent>
      </Card>
    );
  }

  // Super admin veya agency olmayan kullanıcılar için gösterme
  if (!usage) {
    return null;
  }

  const usagePercentage = usage.message_limit === -1 
    ? 0 
    : (usage.monthly_message_count / usage.message_limit) * 100;

  const isNearLimit = usagePercentage >= 80 && usage.message_limit !== -1;
  const isOverLimit = usagePercentage >= 100 && usage.message_limit !== -1;

  const getPlanBadgeColor = (planType: string) => {
    switch (planType) {
      case 'starter': return 'bg-blue-500';
      case 'professional': return 'bg-purple-500';
      case 'enterprise': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  const getPlanName = (planType: string) => {
    switch (planType) {
      case 'starter': return 'Başlangıç';
      case 'professional': return 'Profesyonel';
      case 'enterprise': return 'Kurumsal';
      default: return planType;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Paket Bilgisi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Aktif Paket
            </span>
            <Badge className={getPlanBadgeColor(usage.plan_type)}>
              {getPlanName(usage.plan_type)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Durum</span>
              <Badge variant={usage.subscription_status === 'active' ? 'default' : usage.subscription_status === 'trial' ? 'secondary' : 'destructive'}>
                {usage.subscription_status === 'active' ? 'Aktif' : usage.subscription_status === 'trial' ? 'Deneme' : 'Süresi Doldu'}
              </Badge>
            </div>
            
            {usage.subscription_status === 'trial' && usage.trial_ends_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Deneme Süresi</span>
                <span className="font-medium">{getDaysRemaining(usage.trial_ends_at)} gün kaldı</span>
              </div>
            )}
            
            {usage.subscription_status === 'active' && usage.subscription_ends_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Yenileme Tarihi</span>
                <span className="font-medium">{formatDate(usage.subscription_ends_at)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mesaj Kullanımı */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Mesaj Kotası
            </span>
            {isNearLimit && !isOverLimit && (
              <AlertCircle className="w-5 h-5 text-warning" />
            )}
            {isOverLimit && (
              <AlertCircle className="w-5 h-5 text-destructive" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Bu Ay Kullanılan</span>
              <span className="font-medium">
                {usage.monthly_message_count.toLocaleString('tr-TR')} 
                {usage.message_limit === -1 ? ' (Sınırsız)' : ` / ${usage.message_limit.toLocaleString('tr-TR')}`}
              </span>
            </div>
            
            {usage.message_limit !== -1 && (
              <>
                <Progress 
                  value={Math.min(usagePercentage, 100)} 
                  className={isOverLimit ? 'bg-destructive/20' : isNearLimit ? 'bg-warning/20' : ''}
                />
                
                {isOverLimit && (
                  <div className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Mesaj kotanız doldu! Paketinizi yükseltmeniz gerekiyor.
                  </div>
                )}
                
                {isNearLimit && !isOverLimit && (
                  <div className="text-xs text-warning flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Mesaj kotanızın %{Math.round(100 - usagePercentage)}'i kaldı.
                  </div>
                )}
              </>
            )}
            
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Son Sıfırlama</span>
              <span className="font-medium">{formatDate(usage.last_message_reset_date)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Günlük Ortalama */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Ortalama Kullanım
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Günlük Ortalama</span>
              <span className="font-medium">
                ~{Math.round(usage.monthly_message_count / new Date().getDate())} mesaj/gün
              </span>
            </div>
            
            {usage.message_limit !== -1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tahmini Süre</span>
                <span className="font-medium">
                  {usage.monthly_message_count === 0 
                    ? 'Henüz kullanılmadı' 
                    : Math.round((usage.message_limit - usage.monthly_message_count) / (usage.monthly_message_count / new Date().getDate())) + ' gün'
                  }
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Paket Detayları */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Paket Özellikleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {usage.plan_type === 'starter' && (
              <>
                <div className="flex items-center gap-2">
                  <span>💬 500 mesaj/ay</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💾 30 gün konuşma geçmişi</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📧 Email destek</span>
                </div>
              </>
            )}
            
            {usage.plan_type === 'professional' && (
              <>
                <div className="flex items-center gap-2">
                  <span>💬 2.000 mesaj/ay</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💾 90 gün konuşma geçmişi</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⚡ Öncelikli destek</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🎯 Kullanıcı profilleri</span>
                </div>
              </>
            )}
            
            {usage.plan_type === 'enterprise' && (
              <>
                <div className="flex items-center gap-2">
                  <span>💬 Sınırsız mesaj</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💾 Sınırsız geçmiş</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🚀 7/24 destek</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔌 API erişimi</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};