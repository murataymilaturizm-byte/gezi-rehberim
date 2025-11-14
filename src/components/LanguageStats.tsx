import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Languages, Users, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LanguageData {
  language: string;
  languageName: string;
  userCount: number;
  messageCount: number;
  color: string;
}

interface Agency {
  id: string;
  agency_name: string;
}

interface LanguageStatsProps {
  isSuperAdmin?: boolean;
}

const languageNames: Record<string, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  ru: "Русский",
  ar: "العربية",
  fr: "Français",
  es: "Español"
};

const languageColors: Record<string, string> = {
  tr: "#ef4444",
  en: "#3b82f6",
  de: "#f59e0b",
  ru: "#8b5cf6",
  ar: "#10b981",
  fr: "#ec4899",
  es: "#f97316"
};

export const LanguageStats = ({ isSuperAdmin = false }: LanguageStatsProps) => {
  const { t } = useTranslation();
  const [languageData, setLanguageData] = useState<LanguageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAgencies();
    } else {
      loadLanguageStats();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (selectedAgencyId || !isSuperAdmin) {
      loadLanguageStats();
    }
  }, [selectedAgencyId]);

  const loadAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, agency_name")
        .order("agency_name");

      if (error) throw error;
      setAgencies(data || []);
      
      if (data && data.length > 0) {
        setSelectedAgencyId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading agencies:", error);
    }
  };

  const loadLanguageStats = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("whatsapp_user_profiles")
        .select("language_preference, total_messages");

      if (isSuperAdmin && selectedAgencyId) {
        query = query.eq("agency_id", selectedAgencyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Dil bazlı istatistikleri hesapla
      const languageMap = new Map<string, { userCount: number; messageCount: number }>();
      let totalUsersCount = 0;
      let totalMessagesCount = 0;

      data?.forEach((profile) => {
        const lang = profile.language_preference || 'tr';
        const messages = profile.total_messages || 0;
        
        if (!languageMap.has(lang)) {
          languageMap.set(lang, { userCount: 0, messageCount: 0 });
        }
        
        const stats = languageMap.get(lang)!;
        stats.userCount += 1;
        stats.messageCount += messages;
        
        totalUsersCount += 1;
        totalMessagesCount += messages;
      });

      // Harita'yı diziye dönüştür ve sırala
      const languageStats: LanguageData[] = Array.from(languageMap.entries())
        .map(([language, stats]) => ({
          language,
          languageName: languageNames[language] || language,
          userCount: stats.userCount,
          messageCount: stats.messageCount,
          color: languageColors[language] || "#6b7280"
        }))
        .sort((a, b) => b.userCount - a.userCount);

      setLanguageData(languageStats);
      setTotalUsers(totalUsersCount);
      setTotalMessages(totalMessagesCount);
    } catch (error) {
      console.error("Error loading language stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            {t("admin.whatsapp.languageStats.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {t("common.loading")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Dil Bazlı İstatistikler
          </CardTitle>
          {isSuperAdmin && agencies.length > 0 && (
            <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.agency_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Özet Kartlar */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">Toplam Kullanıcı</span>
              </div>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm">Toplam Mesaj</span>
              </div>
              <div className="text-2xl font-bold">{totalMessages.toLocaleString()}</div>
            </div>
          </div>

          {/* Grafik */}
          {languageData.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">Kullanıcı Sayısı (Dil Bazlı)</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={languageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="languageName" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === "Kullanıcı Sayısı") {
                        return [value, name];
                      }
                      return [value.toLocaleString(), name];
                    }}
                  />
                  <Bar dataKey="userCount" name="Kullanıcı Sayısı" radius={[8, 8, 0, 0]}>
                    {languageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detaylı Liste */}
          <div className="space-y-3">
            <h4 className="font-medium">Detaylı Dil Dağılımı</h4>
            <div className="space-y-2">
              {languageData.map((lang) => (
                <div
                  key={lang.language}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: lang.color }}
                    />
                    <div>
                      <div className="font-medium">{lang.languageName}</div>
                      <div className="text-sm text-muted-foreground">
                        {lang.userCount} kullanıcı • {lang.messageCount.toLocaleString()} mesaj
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {((lang.userCount / totalUsers) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {languageData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Henüz dil verisi bulunmuyor
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};