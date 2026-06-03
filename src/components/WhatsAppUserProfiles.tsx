import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Users, MessageSquare, TrendingUp, MapPin, Building2, Tag, Plus, ShoppingBag, DollarSign, Star, User, Bot, History, UserSearch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { MetricsBar } from "./crm/MetricsBar";
import { CrmFilters, type SegmentFilter, type SortKey } from "./crm/CrmFilters";
import { CustomerListItem } from "./crm/CustomerListItem";
import { AutoTagBadge, ManualTagBadge } from "./crm/TagBadge";
import { computeAutoTags } from "./crm/customerTags";

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
  tags: string[] | null;
  total_bookings: number;
  total_spent: number;
  feedback_score: number | null;
  feedback_comment: string | null;
  language_preference: string | null;
}

interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface Agency {
  id: string;
  name: string;
}

interface WhatsAppUserProfilesProps {
  isSuperAdmin?: boolean;
}

export const WhatsAppUserProfiles = ({ isSuperAdmin = false }: WhatsAppUserProfilesProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [currentAgencyId, setCurrentAgencyId] = useState<string>("");
  const [newTag, setNewTag] = useState("");
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [agencyCurrency, setAgencyCurrency] = useState<string>("TRY");

  // CRM filtre/sıralama state
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [sort, setSort] = useState<SortKey>("lastActivity");

  const CURRENCY_SYM: Record<string, string> = {
    TRY: "₺", USD: "$", EUR: "€", GBP: "£", SAR: "﷼", AED: "د.إ", RUB: "₽",
  };
  const currencySym = CURRENCY_SYM[agencyCurrency] ?? agencyCurrency;

  useEffect(() => {
    if (isSuperAdmin) {
      loadAgencies();
    } else {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from("agencies").select("id, primary_currency").eq("user_id", user.id).single()
          .then(({ data }) => {
            if (data?.id) {
              setCurrentAgencyId(data.id);
              if (data.primary_currency) setAgencyCurrency(data.primary_currency);
              loadProfiles(data.id);
            }
          });
      });
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (selectedAgencyId) {
      loadProfiles(selectedAgencyId);
    }
  }, [selectedAgencyId]);

  useEffect(() => {
    if (selectedProfile) {
      loadConversations(selectedProfile.phone);
    }
  }, [selectedProfile]);

  const loadAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setAgencies(data || []);

      if (data && data.length > 0) {
        setSelectedAgencyId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading agencies:", error);
      toast({ title: t("common.error"), description: t("common.loadError"), variant: "destructive" });
    }
  };

  const loadProfiles = async (agencyIdOverride?: string) => {
    try {
      setLoading(true);
      const effectiveAgencyId = agencyIdOverride || (isSuperAdmin ? selectedAgencyId : currentAgencyId);
      let query = supabase
        .from("whatsapp_user_profiles")
        .select("id, phone, full_name, total_messages, last_interaction_at, first_interaction_at, preferred_destinations, budget_range, preferred_tour_type, last_search_query, tags, total_bookings, total_spent, feedback_score, feedback_comment, language_preference")
        .order("last_interaction_at", { ascending: false });

      if (effectiveAgencyId) {
        query = query.eq("agency_id", effectiveAgencyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProfiles(data || []);

      if (data && data.length > 0) {
        setSelectedProfile(data[0]);
      }
    } catch (error) {
      console.error("Error loading profiles:", error);
      toast({ title: t("common.error"), description: t("common.loadError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (phone: string) => {
    try {
      setLoadingConversations(true);
      const effectiveAgencyId = isSuperAdmin ? selectedAgencyId : currentAgencyId;
      let query = supabase
        .from("whatsapp_conversations")
        .select("id, role, content, created_at")
        .eq("phone", phone)
        .neq("role", "system")
        .order("created_at", { ascending: true });

      if (effectiveAgencyId) {
        query = query.eq("agency_id", effectiveAgencyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast({
        title: t("common.error"),
        description: "Konuşmalar yüklenirken bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setLoadingConversations(false);
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

    if (daysSince === 0) return { label: t("admin.whatsapp.userProfiles.todayActive"), color: "bg-emerald-500" };
    if (daysSince === 1) return { label: t("admin.whatsapp.userProfiles.yesterdayActive"), color: "bg-blue-500" };
    if (daysSince <= 7) return { label: `${daysSince} ${t("admin.whatsapp.userProfiles.daysAgo")}`, color: "bg-yellow-500" };
    if (daysSince <= 30) return { label: `${daysSince} ${t("admin.whatsapp.userProfiles.daysAgo")}`, color: "bg-orange-500" };
    return { label: `${daysSince} ${t("admin.whatsapp.userProfiles.daysAgo")}`, color: "bg-muted-foreground/60" };
  };

  // Profillere otomatik etiket türet (her render değil — useMemo ile sabit)
  const profilesWithAutoTags = useMemo(
    () =>
      profiles.map((p) => ({
        profile: p,
        autoTags: computeAutoTags(p),
      })),
    [profiles]
  );

  // Segment sayımlarını hesapla — filtre çubuğundaki rozetlerde gösterilir
  const segmentCounts = useMemo(() => {
    const counts: Record<SegmentFilter, number> = {
      all: profiles.length,
      vip: 0,
      customer: 0,
      prospect: 0,
      active: 0,
      inactive: 0,
    };
    for (const { autoTags } of profilesWithAutoTags) {
      for (const tag of autoTags) {
        counts[tag]++;
      }
    }
    return counts;
  }, [profiles.length, profilesWithAutoTags]);

  // Filtrelenmiş + sıralanmış görünür liste
  const visibleProfiles = useMemo(() => {
    const searchLower = search.trim().toLocaleLowerCase("tr-TR");

    const filtered = profilesWithAutoTags
      .filter(({ profile, autoTags }) => {
        // Segment filtre
        if (segment !== "all" && !autoTags.includes(segment)) return false;
        // Arama
        if (searchLower) {
          const nameLower = (profile.full_name || "").toLocaleLowerCase("tr-TR");
          const phoneLower = profile.phone.toLocaleLowerCase("tr-TR");
          if (!nameLower.includes(searchLower) && !phoneLower.includes(searchLower)) {
            return false;
          }
        }
        return true;
      })
      .map(({ profile }) => profile);

    // Sıralama
    const sorted = [...filtered];
    switch (sort) {
      case "spending":
        sorted.sort((a, b) => Number(b.total_spent) - Number(a.total_spent));
        break;
      case "bookings":
        sorted.sort((a, b) => b.total_bookings - a.total_bookings);
        break;
      case "name":
        sorted.sort((a, b) =>
          (a.full_name || "").localeCompare(b.full_name || "", "tr-TR")
        );
        break;
      case "lastActivity":
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.last_interaction_at).getTime() -
            new Date(a.last_interaction_at).getTime()
        );
    }

    return sorted;
  }, [profilesWithAutoTags, segment, search, sort]);

  const selectedAutoTags = useMemo(
    () => (selectedProfile ? computeAutoTags(selectedProfile) : []),
    [selectedProfile]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t("admin.whatsapp.userProfiles.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("admin.whatsapp.userProfiles.loadingUsers")}</p>
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
            {t("admin.whatsapp.userProfiles.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("admin.whatsapp.userProfiles.noUsers")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Üst başlık: başlık + super-admin acente seçici */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            {t("admin.whatsapp.userProfiles.title")}
          </h2>
          <Badge variant="secondary">
            {profiles.length} {t("admin.whatsapp.userProfiles.users")}
          </Badge>
        </div>

        {isSuperAdmin && agencies.length > 0 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
              <SelectTrigger className="w-[220px] sm:w-[250px]">
                <SelectValue placeholder={t("admin.whatsapp.userProfiles.selectAgency")} />
              </SelectTrigger>
              <SelectContent>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ÜST METRIK ŞERİDİ */}
      <MetricsBar profiles={profiles} currencySym={currencySym} />

      {/* ANA PANEL — liste + detay */}
      <Card>
        <CardContent className="p-3 sm:p-4 md:p-5">
          {/* Filtre çubuğu */}
          <div className="mb-4">
            <CrmFilters
              search={search}
              setSearch={setSearch}
              segment={segment}
              setSegment={setSegment}
              sort={sort}
              setSort={setSort}
              counts={segmentCounts}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-4">
            {/* ── SOL: zenginleştirilmiş liste ── */}
            <div>
              {visibleProfiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                  <UserSearch className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm">
                    {t("admin.whatsapp.userProfiles.noMatch", {
                      defaultValue: "Sonuç yok",
                    })}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[760px] pr-2">
                  <div className="space-y-1.5">
                    {visibleProfiles.map((profile) => (
                      <CustomerListItem
                        key={profile.id}
                        id={profile.id}
                        name={profile.full_name}
                        phone={profile.phone}
                        totalMessages={profile.total_messages}
                        totalBookings={profile.total_bookings}
                        totalSpent={Number(profile.total_spent || 0)}
                        lastInteractionAt={profile.last_interaction_at}
                        lastSearchQuery={profile.last_search_query}
                        manualTagCount={profile.tags?.length || 0}
                        isSelected={selectedProfile?.id === profile.id}
                        currencySym={currencySym}
                        onClick={() => setSelectedProfile(profile)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* ── SAĞ: Detay paneli — TUR 2'de zenginleşecek; bu turda etiket render'ı renkli ── */}
            {selectedProfile && (
              <div>
                <div className="mb-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Detay üst avatar */}
                      <div className="w-14 h-14 rounded-full bg-gradient-ocean text-primary-foreground flex items-center justify-center text-xl font-bold shadow-md flex-shrink-0">
                        {(selectedProfile.full_name?.trim() || selectedProfile.phone.slice(-1) || "?")
                          .charAt(0)
                          .toLocaleUpperCase("tr-TR")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl sm:text-2xl font-bold leading-tight truncate">
                          {selectedProfile.full_name || t("admin.whatsapp.userProfiles.unnamed")}
                        </h2>
                        <p className="text-sm text-muted-foreground font-mono mt-0.5">
                          {selectedProfile.phone}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {selectedAutoTags.map((tag) => (
                            <AutoTagBadge key={tag} tag={tag} size="sm" />
                          ))}
                          {selectedProfile.language_preference && (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                              {selectedProfile.language_preference}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div
                        className={`w-3 h-3 rounded-full inline-block ${getActivityStatus(selectedProfile.last_interaction_at).color}`}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {getActivityStatus(selectedProfile.last_interaction_at).label}
                      </p>
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="profile" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="profile">{t("admin.whatsapp.userProfiles.tabs.profile")}</TabsTrigger>
                    <TabsTrigger value="preferences">{t("admin.whatsapp.userProfiles.tabs.preferences")}</TabsTrigger>
                    <TabsTrigger value="tags">{t("admin.whatsapp.userProfiles.tabs.tags")}</TabsTrigger>
                    <TabsTrigger value="conversations">{t("admin.whatsapp.userProfiles.tabs.conversations")}</TabsTrigger>
                  </TabsList>

                  <ScrollArea className="h-[640px] mt-4">
                    {/* Tab 1: Profil Bilgileri — DEĞİŞMEDİ (TUR 2'de zenginleşir) */}
                    <TabsContent value="profile" className="space-y-4 mt-0">
                      <div className="grid grid-cols-3 gap-3 sm:gap-4">
                        <Card className="bg-gradient-ocean text-primary-foreground border-0">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <ShoppingBag className="w-4 h-4 opacity-80" />
                              <p className="text-xs opacity-80">{t("admin.whatsapp.userProfiles.totalBookings")}</p>
                            </div>
                            <p className="text-2xl sm:text-3xl font-bold">{selectedProfile.total_bookings}</p>
                          </CardContent>
                        </Card>

                        <Card className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <p className="text-xs text-muted-foreground">{t("admin.whatsapp.userProfiles.totalSpent")}</p>
                            </div>
                            <p className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                              {Number(selectedProfile.total_spent).toLocaleString()} {currencySym}
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Star className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <p className="text-xs text-muted-foreground">{t("admin.whatsapp.userProfiles.averageSpending")}</p>
                            </div>
                            <p className="text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-300">
                              {selectedProfile.total_bookings > 0
                                ? Math.round(Number(selectedProfile.total_spent) / selectedProfile.total_bookings).toLocaleString()
                                : 0}{" "}
                              {currencySym}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* İletişim Metrikleri */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            {t("admin.whatsapp.userProfiles.communicationMetrics")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t("admin.whatsapp.userProfiles.totalMessages")}</p>
                              <p className="text-2xl font-bold">{selectedProfile.total_messages}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t("admin.whatsapp.userProfiles.dailyAverage")}</p>
                              <p className="text-2xl font-bold">
                                {(
                                  selectedProfile.total_messages /
                                  Math.max(
                                    1,
                                    Math.ceil(
                                      (Date.now() - new Date(selectedProfile.first_interaction_at).getTime()) /
                                        (1000 * 60 * 60 * 24)
                                    )
                                  )
                                ).toFixed(1)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t("admin.whatsapp.userProfiles.firstInteraction")}</p>
                              <p className="text-sm font-medium">{formatDate(selectedProfile.first_interaction_at)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t("admin.whatsapp.userProfiles.lastInteraction")}</p>
                              <p className="text-sm font-medium">{formatDate(selectedProfile.last_interaction_at)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Müşteri Memnuniyeti */}
                      {(selectedProfile.feedback_score || selectedProfile.feedback_comment) && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Star className="w-4 h-4" />
                              {t("userProfiles.customerSatisfaction")}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {selectedProfile.feedback_score && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">{t("userProfiles.feedbackScore")}</p>
                                <div className="flex items-center gap-1">
                                  {[...Array(10)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-5 h-5 ${
                                        i < selectedProfile.feedback_score!
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-muted-foreground/30"
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-2 text-lg font-bold">{selectedProfile.feedback_score}/10</span>
                                </div>
                              </div>
                            )}

                            {selectedProfile.feedback_comment && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">{t("userProfiles.feedbackComment")}</p>
                                <p className="text-sm bg-muted p-3 rounded-md italic">
                                  "{selectedProfile.feedback_comment}"
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    {/* Tab 2: Tercihler — DEĞİŞMEDİ */}
                    <TabsContent value="preferences" className="space-y-4 mt-0">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            {t("admin.whatsapp.userProfiles.preferencesInterests")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {selectedProfile.preferred_destinations && selectedProfile.preferred_destinations.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">{t("admin.whatsapp.userProfiles.interestedDestinations")}</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedProfile.preferred_destinations.map((dest, idx) => (
                                  <Badge key={idx} variant="secondary" className="gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {dest}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            {selectedProfile.preferred_tour_type && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">{t("admin.whatsapp.userProfiles.preferredTourType")}</p>
                                <Badge>{selectedProfile.preferred_tour_type}</Badge>
                              </div>
                            )}

                            {selectedProfile.budget_range && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">{t("admin.whatsapp.userProfiles.budgetRange")}</p>
                                <Badge variant="outline">{selectedProfile.budget_range}</Badge>
                              </div>
                            )}
                          </div>

                          {selectedProfile.last_search_query && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t("admin.whatsapp.userProfiles.lastSearch")}</p>
                              <p className="text-sm bg-muted p-3 rounded-md font-medium">
                                "{selectedProfile.last_search_query}"
                              </p>
                            </div>
                          )}

                          {!selectedProfile.preferred_destinations?.length &&
                            !selectedProfile.preferred_tour_type &&
                            !selectedProfile.budget_range &&
                            !selectedProfile.last_search_query && (
                              <div className="text-center py-8 text-muted-foreground">
                                <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">{t("admin.whatsapp.userProfiles.noFeedback")}</p>
                              </div>
                            )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Tab 3: Etiketler — otomatik + manuel ayrımlı RENKLİ */}
                    <TabsContent value="tags" className="space-y-4 mt-0">
                      {/* Otomatik etiketler — sistem türevli, silinemez */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            {t("admin.whatsapp.userProfiles.autoTags.heading", { defaultValue: "Otomatik Etiketler" })}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("admin.whatsapp.userProfiles.autoTags.description", {
                              defaultValue: "Sistem rezervasyon, harcama ve aktivite verisinden hesaplar.",
                            })}
                          </p>
                        </CardHeader>
                        <CardContent>
                          {selectedAutoTags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedAutoTags.map((tag) => (
                                <AutoTagBadge key={tag} tag={tag} size="sm" />
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              {t("admin.whatsapp.userProfiles.autoTags.empty", {
                                defaultValue: "Henüz yeterli aktivite yok.",
                              })}
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Manuel etiketler — acente eklediği, silinebilir */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            {t("admin.whatsapp.userProfiles.customerTags")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {selectedProfile.tags && selectedProfile.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {selectedProfile.tags.map((tag, idx) => (
                                  <ManualTagBadge
                                    key={`${tag}-${idx}`}
                                    label={tag}
                                    size="sm"
                                    onRemove={async () => {
                                      try {
                                        const newTags = selectedProfile.tags?.filter((x) => x !== tag) || [];
                                        const { error } = await supabase
                                          .from("whatsapp_user_profiles")
                                          .update({ tags: newTags })
                                          .eq("id", selectedProfile.id);
                                        if (error) throw error;
                                        setSelectedProfile({ ...selectedProfile, tags: newTags });
                                        setProfiles(profiles.map((p) =>
                                          p.id === selectedProfile.id ? { ...p, tags: newTags } : p
                                        ));
                                        toast({ title: t("admin.whatsapp.userProfiles.tagRemoved") });
                                      } catch (error) {
                                        console.error("Error removing tag:", error);
                                        toast({
                                          title: t("admin.whatsapp.userProfiles.tagError"),
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  />
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Input
                                placeholder={t("admin.whatsapp.userProfiles.addTag")}
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === "Enter" && newTag.trim()) {
                                    try {
                                      const newTags = [...(selectedProfile.tags || []), newTag.trim()];
                                      const { error } = await supabase
                                        .from("whatsapp_user_profiles")
                                        .update({ tags: newTags })
                                        .eq("id", selectedProfile.id);
                                      if (error) throw error;
                                      setSelectedProfile({ ...selectedProfile, tags: newTags });
                                      setProfiles(profiles.map((p) =>
                                        p.id === selectedProfile.id ? { ...p, tags: newTags } : p
                                      ));
                                      setNewTag("");
                                      toast({ title: t("admin.whatsapp.userProfiles.tagAdded") });
                                    } catch (error) {
                                      console.error("Error adding tag:", error);
                                      toast({
                                        title: t("admin.whatsapp.userProfiles.tagError"),
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                              />
                              <Button
                                size="icon"
                                onClick={async () => {
                                  if (!newTag.trim()) return;
                                  try {
                                    const newTags = [...(selectedProfile.tags || []), newTag.trim()];
                                    const { error } = await supabase
                                      .from("whatsapp_user_profiles")
                                      .update({ tags: newTags })
                                      .eq("id", selectedProfile.id);
                                    if (error) throw error;
                                    setSelectedProfile({ ...selectedProfile, tags: newTags });
                                    setProfiles(profiles.map((p) =>
                                      p.id === selectedProfile.id ? { ...p, tags: newTags } : p
                                    ));
                                    setNewTag("");
                                    toast({ title: t("admin.whatsapp.userProfiles.tagAdded") });
                                  } catch (error) {
                                    console.error("Error adding tag:", error);
                                    toast({
                                      title: t("admin.whatsapp.userProfiles.tagError"),
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Tab 4: Konuşma Geçmişi — DEĞİŞMEDİ */}
                    <TabsContent value="conversations" className="space-y-4 mt-0">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <History className="w-4 h-4" />
                            {t("admin.whatsapp.userProfiles.conversationHistory")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {loadingConversations ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20 animate-pulse" />
                              <p className="text-sm">{t("admin.whatsapp.userProfiles.loadingConversations")}</p>
                            </div>
                          ) : conversations.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                              <p className="text-sm">{t("admin.whatsapp.userProfiles.noConversations")}</p>
                            </div>
                          ) : (
                            <ScrollArea className="h-[500px] pr-4">
                              <div className="space-y-4">
                                {conversations.map((msg) => (
                                  <div
                                    key={msg.id}
                                    className={`flex gap-3 ${msg.role === "user" ? "flex-row" : "flex-row-reverse"}`}
                                  >
                                    <div
                                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                        msg.role === "user"
                                          ? "bg-primary/10 text-primary"
                                          : "bg-secondary text-secondary-foreground"
                                      }`}
                                    >
                                      {msg.role === "user" ? (
                                        <User className="w-4 h-4" />
                                      ) : (
                                        <Bot className="w-4 h-4" />
                                      )}
                                    </div>
                                    <div className="flex-1 max-w-[80%]">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="text-xs font-medium">
                                          {msg.role === "user" ? t("admin.whatsapp.userProfiles.customer") : t("admin.whatsapp.userProfiles.assistant")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {format(new Date(msg.created_at), "dd MMM yyyy, HH:mm", { locale: tr })}
                                        </p>
                                      </div>
                                      <div
                                        className={`p-3 rounded-lg text-sm ${
                                          msg.role === "user"
                                            ? "bg-primary/10 text-foreground"
                                            : "bg-muted text-foreground"
                                        }`}
                                      >
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
