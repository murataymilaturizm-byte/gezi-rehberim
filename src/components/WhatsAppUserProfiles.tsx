import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Users, MessageSquare, Calendar, TrendingUp, MapPin, Building2 } from "lucide-react";

interface UserProfile {
  id: string;
  phone: string;
  full_name: string | null;
  total_messages: number;
  last_interaction_at: string;
  first_interaction_at: string;
  preferred_destinations: string[] | null;
  budget_range: string | null;
  preferred_tour_type: string | null;
  last_search_query: string | null;
}

interface Agency {
  id: string;
  agency_name: string;
}

interface WhatsAppUserProfilesProps {
  isSuperAdmin?: boolean;
}

export const WhatsAppUserProfiles = ({ isSuperAdmin = false }: WhatsAppUserProfilesProps) => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");

  useEffect(() => {
    if (isSuperAdmin) {
      loadAgencies();
    } else {
      loadProfiles();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (selectedAgencyId) {
      loadProfiles();
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
      
      // İlk acenteyi seç
      if (data && data.length > 0) {
        setSelectedAgencyId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading agencies:", error);
    }
  };

  const loadProfiles = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("whatsapp_user_profiles")
        .select("*")
        .order("last_interaction_at", { ascending: false });

      // Süper admin ise seçilen acente için filtrele
      if (isSuperAdmin && selectedAgencyId) {
        query = query.eq("agency_id", selectedAgencyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProfiles(data || []);
      
      if (data && data.length > 0) {
        setSelectedProfile(data[0]);
      }
    } catch (error) {
      console.error("Error loading profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActivityStatus = (lastInteraction: string) => {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSince === 0) return { label: t("admin.whatsapp.userProfiles.todayActive"), color: "bg-green-500" };
    if (daysSince === 1) return { label: t("admin.whatsapp.userProfiles.yesterdayActive"), color: "bg-blue-500" };
    if (daysSince <= 7) return { label: `${daysSince} ${t("admin.whatsapp.userProfiles.daysAgo")}`, color: "bg-yellow-500" };
    if (daysSince <= 30) return { label: `${daysSince} ${t("admin.whatsapp.userProfiles.daysAgo")}`, color: "bg-orange-500" };
    return { label: `${daysSince} ${t("admin.whatsapp.userProfiles.daysAgo")}`, color: "bg-gray-500" };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            WhatsApp Kullanıcı Profilleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            WhatsApp Kullanıcı Profilleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Henüz WhatsApp kullanıcısı yok</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <CardTitle>WhatsApp Kullanıcı Profilleri</CardTitle>
            <Badge variant="secondary">
              {profiles.length} Kullanıcı
            </Badge>
          </div>
          
          {isSuperAdmin && agencies.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Acente Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.agency_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kullanıcı Listesi */}
          <div className="md:col-span-1">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-2">
                {profiles.map((profile) => {
                  const activity = getActivityStatus(profile.last_interaction_at);
                  const isSelected = selectedProfile?.id === profile.id;
                  
                  return (
                    <div
                      key={profile.id}
                      onClick={() => setSelectedProfile(profile)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">
                            {profile.full_name || "İsimsiz"}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {profile.phone}
                          </p>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${activity.color}`} />
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />
                        <span>{profile.total_messages} mesaj</span>
                      </div>
                      
                      <div className="mt-1 text-xs text-muted-foreground">
                        {activity.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Profil Detayı */}
          {selectedProfile && (
            <div className="md:col-span-2">
              <div className="space-y-4">
                {/* Genel Bilgiler */}
                <div className="p-4 rounded-lg border border-border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Genel Bilgiler
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">İsim:</span>
                      <span className="font-medium">
                        {selectedProfile.full_name || "Belirtilmemiş"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Telefon:</span>
                      <span className="font-mono">{selectedProfile.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Toplam Mesaj:</span>
                      <Badge variant="secondary">{selectedProfile.total_messages}</Badge>
                    </div>
                  </div>
                </div>

                {/* Aktivite Bilgileri */}
                <div className="p-4 rounded-lg border border-border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Aktivite
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">İlk Mesaj:</span>
                      <span>{formatDate(selectedProfile.first_interaction_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Son Mesaj:</span>
                      <span>{formatDate(selectedProfile.last_interaction_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Tercihler */}
                <div className="p-4 rounded-lg border border-border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Tercihler
                  </h3>
                  <div className="space-y-3">
                    {selectedProfile.preferred_destinations &&
                      selectedProfile.preferred_destinations.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Tercih Edilen Destinasyonlar:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {selectedProfile.preferred_destinations.map((dest, idx) => (
                              <Badge key={idx} variant="outline" className="gap-1">
                                <MapPin className="w-3 h-3" />
                                {dest}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                    {selectedProfile.preferred_tour_type && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Tercih Edilen Tur Tipi:
                        </p>
                        <Badge>{selectedProfile.preferred_tour_type}</Badge>
                      </div>
                    )}

                    {selectedProfile.budget_range && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Bütçe Aralığı:
                        </p>
                        <Badge variant="secondary">{selectedProfile.budget_range}</Badge>
                      </div>
                    )}

                    {selectedProfile.last_search_query && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Son Arama:
                        </p>
                        <p className="text-sm italic">
                          "{selectedProfile.last_search_query}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* İstatistikler */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-gradient-ocean text-primary-foreground">
                    <p className="text-xs opacity-90">Mesaj/Gün</p>
                    <p className="text-2xl font-bold">
                      {(
                        selectedProfile.total_messages /
                        Math.max(
                          1,
                          Math.ceil(
                            (Date.now() -
                              new Date(selectedProfile.first_interaction_at).getTime()) /
                              (1000 * 60 * 60 * 24)
                          )
                        )
                      ).toFixed(1)}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground">Aktif Gün</p>
                    <p className="text-2xl font-bold">
                      {Math.ceil(
                        (Date.now() -
                          new Date(selectedProfile.first_interaction_at).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
