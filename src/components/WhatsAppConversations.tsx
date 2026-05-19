import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, User, Bot, Building2, ScrollText, Languages,
  Search, Settings, ChevronLeft, ChevronRight, Send, PauseCircle,
  PlayCircle, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { WhatsAppLogs } from "./WhatsAppLogs";
import { LanguageStats } from "./LanguageStats";
import { WhatsAppSettings } from "./WhatsAppSettings";
import { EmptyState } from "./EmptyState";

const PAGE_SIZE = 25;

interface Message {
  id: string;
  phone: string;
  role: string;
  content: string;
  created_at: string;
}

interface ConversationGroup {
  phone: string;
  messages: Message[];
  lastMessageTime: string;
}

interface Agency {
  id: string;
  name: string;
}

interface WhatsAppConversationsProps {
  isSuperAdmin?: boolean;
}

export const WhatsAppConversations = ({ isSuperAdmin = false }: WhatsAppConversationsProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<ConversationGroup[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Mobile: list vs. detail view toggle
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  // Agency id for non-superadmin (for reply feature)
  const [agencyId, setAgencyId] = useState<string>("");

  // Reply / takeover state
  const [replyMessage, setReplyMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [botPaused, setBotPaused] = useState(false);
  const [botPauseLoading, setBotPauseLoading] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAgencies();
    } else {
      // Fetch current user's agencyId
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from("agencies").select("id").eq("user_id", user.id).single()
          .then(({ data }) => { if (data?.id) setAgencyId(data.id); });
      });
      loadConversations();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (selectedAgencyId) {
      loadConversations();
    }
  }, [selectedAgencyId]);

  // Fetch bot pause status when selected phone changes
  useEffect(() => {
    if (!selectedPhone || (!agencyId && !selectedAgencyId)) return;
    const aid = isSuperAdmin ? selectedAgencyId : agencyId;
    if (!aid) return;
    (supabase as any)
      .from("whatsapp_user_profiles")
      .select("bot_paused, bot_paused_until")
      .eq("phone", selectedPhone.replace("whatsapp:", "").replace("+", "").trim())
      .eq("agency_id", aid)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          const pausedUntil = data.bot_paused_until ? new Date(data.bot_paused_until) : null;
          setBotPaused(!!data.bot_paused && (!pausedUntil || pausedUntil > new Date()));
        } else {
          setBotPaused(false);
        }
      });
  }, [selectedPhone, agencyId, selectedAgencyId, isSuperAdmin]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedPhone, conversations]);

  const loadAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .order("name");

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

  const loadConversations = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("created_at", { ascending: false });

      // Süper admin ise seçilen acente için filtrele
      if (isSuperAdmin && selectedAgencyId) {
        query = query.eq("agency_id", selectedAgencyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Konuşmaları telefon numarasına göre grupla
      const grouped = (data || []).reduce((acc: Record<string, Message[]>, msg) => {
        if (!acc[msg.phone]) {
          acc[msg.phone] = [];
        }
        acc[msg.phone].push(msg);
        return acc;
      }, {});

      // Her grubu bir ConversationGroup'a çevir
      const groupedArray: ConversationGroup[] = Object.entries(grouped).map(([phone, messages]) => ({
        phone,
        messages: messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        lastMessageTime: messages[0].created_at
      }));

      // Son mesaja göre sırala
      groupedArray.sort((a, b) => 
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setConversations(groupedArray);
      
      // İlk konuşmayı seç
      if (groupedArray.length > 0 && !selectedPhone) {
        setSelectedPhone(groupedArray[0].phone);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedPhone) return;
    const aid = isSuperAdmin ? selectedAgencyId : agencyId;
    if (!aid) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-manual-message", {
        body: { agencyId: aid, phone: selectedPhone.replace("whatsapp:", "").replace("+", "").trim(), message: replyMessage.trim() },
      });
      if (error) throw error;
      toast({ title: t("conversations.sendSuccess") });
      setReplyMessage("");
      await loadConversations();
    } catch (err: any) {
      const msg = err.message?.includes("OUTSIDE_24H")
        ? t("conversations.outside24h")
        : err.message || t("conversations.sendError");
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleToggleBotPause = async () => {
    if (!selectedPhone) return;
    const aid = isSuperAdmin ? selectedAgencyId : agencyId;
    if (!aid) return;

    setBotPauseLoading(true);
    try {
      const normalizedPhone = selectedPhone.replace("whatsapp:", "").replace("+", "").trim();
      const newPaused = !botPaused;
      await (supabase as any)
        .from("whatsapp_user_profiles")
        .upsert(
          {
            phone: normalizedPhone,
            agency_id: aid,
            bot_paused: newPaused,
            bot_paused_until: newPaused
              ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              : null,
          },
          { onConflict: "phone,agency_id" }
        );
      setBotPaused(newPaused);
      toast({ title: newPaused ? t("conversations.botPaused") : t("conversations.botResumed") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setBotPauseLoading(false);
    }
  };

  const handleSelectConversation = (phone: string) => {
    setSelectedPhone(phone);
    if (isMobile) setMobileView("detail");
  };

  const selectedConversation = conversations.find(c => c.phone === selectedPhone);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.phone.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredConversations.length / PAGE_SIZE));
  const paginatedConversations = filteredConversations.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="conversations" className="w-full">
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp Yönetimi
                </CardTitle>
                
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
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="conversations" className="flex items-center gap-1 text-xs sm:text-sm">
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Konuşmalar</span>
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-1 text-xs sm:text-sm">
                  <ScrollText className="h-4 w-4" />
                  <span className="hidden sm:inline">Loglar</span>
                </TabsTrigger>
                <TabsTrigger value="language-stats" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Languages className="h-4 w-4" />
                  <span className="hidden sm:inline">Dil İstat.</span>
                </TabsTrigger>
                {!isSuperAdmin && (
                  <TabsTrigger value="integration" className="flex items-center gap-1 text-xs sm:text-sm">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Entegrasyon</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
          </CardHeader>
          
          <CardContent>
            <TabsContent value="conversations" className="mt-0">
              {conversations.length === 0 ? (
                <EmptyState
                  icon={MessageCircle}
                  title={t("conversations.emptyTitle")}
                  description={t("conversations.emptyDescription")}
                />
              ) : (
                <div className="flex gap-4 min-h-[600px]">
                  {/* Sol taraf - Konuşma listesi */}
                  <div className={`${isMobile && mobileView === "detail" ? "hidden" : "flex"} flex-col w-full md:w-1/3 space-y-2`}>
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        placeholder="Ara..."
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {filteredConversations.length} konuşma
                      {totalPages > 1 && ` · Sayfa ${currentPage}/${totalPages}`}
                    </p>
                    <ScrollArea className="h-[540px] pr-4">
                      {paginatedConversations.map((conv) => (
                        <button
                          key={conv.phone}
                          onClick={() => handleSelectConversation(conv.phone)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedPhone === conv.phone
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-muted border-border"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4" />
                            <p className="font-medium text-sm">{conv.phone}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {conv.messages.length} {t("admin.whatsapp.conversations.messages")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(conv.lastMessageTime), "dd MMM yyyy, HH:mm", { locale: tr })}
                          </p>
                        </button>
                      ))}
                    </ScrollArea>
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 md:h-7 px-3 md:px-2"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4 md:h-3 md:w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 md:h-7 px-3 md:px-2"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        >
                          <ChevronRight className="h-4 w-4 md:h-3 md:w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Sağ taraf - Mesajlar + Reply */}
                  <div className={`${isMobile && mobileView === "list" ? "hidden" : "flex"} flex-col flex-1 min-h-0`}>
                    {/* Mobile back button */}
                    {isMobile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="self-start mb-2"
                        onClick={() => setMobileView("list")}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {t("admin.back")}
                      </Button>
                    )}

                    {selectedConversation ? (
                      <>
                        <ScrollArea className="h-[440px] pr-4">
                          <div className="space-y-3 pb-2">
                            {selectedConversation.messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex gap-3 ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                              >
                                <div className={`flex gap-2 max-w-[80%] ${msg.role === "user" ? "flex-row" : "flex-row-reverse"}`}>
                                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-secondary" : "bg-primary"}`}>
                                    {msg.role === "user" ? (
                                      <User className="h-4 w-4 text-secondary-foreground" />
                                    ) : (
                                      <Bot className="h-4 w-4 text-primary-foreground" />
                                    )}
                                  </div>
                                  <div className={`rounded-lg p-3 ${msg.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    <p className={`text-xs mt-1 ${msg.role === "user" ? "text-secondary-foreground/60" : "text-primary-foreground/60"}`}>
                                      {format(new Date(msg.created_at), "HH:mm", { locale: tr })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>

                        {/* Takeover panel */}
                        {!isSuperAdmin && (
                          <div className="border-t pt-3 mt-2 space-y-2">
                            {/* Bot status */}
                            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                              <div className="flex items-center gap-2">
                                {botPaused ? (
                                  <PauseCircle className="h-4 w-4 text-orange-500 shrink-0" />
                                ) : (
                                  <PlayCircle className="h-4 w-4 text-green-500 shrink-0" />
                                )}
                                <div>
                                  <p className="text-xs font-medium">
                                    {botPaused ? t("conversations.botPausedTitle") : t("conversations.botActiveTitle")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {botPaused ? t("conversations.botPausedDescription") : t("conversations.botActiveDescription")}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant={botPaused ? "default" : "outline"}
                                size="sm"
                                className="text-xs h-7"
                                disabled={botPauseLoading}
                                onClick={handleToggleBotPause}
                              >
                                {botPauseLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : botPaused ? t("conversations.resumeBot") : t("conversations.pauseBot")}
                              </Button>
                            </div>

                            {/* Reply textarea */}
                            <div className="space-y-1.5">
                              <Textarea
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                placeholder={t("conversations.replyPlaceholder")}
                                rows={2}
                                disabled={sending}
                                className="resize-none text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    handleSendReply();
                                  }
                                }}
                              />
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">{t("conversations.replyHint")}</p>
                                <Button
                                  size="sm"
                                  onClick={handleSendReply}
                                  disabled={!replyMessage.trim() || sending}
                                  className="h-10 md:h-8"
                                >
                                  {sending ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Send className="h-3 w-3 mr-1" />
                                  )}
                                  {sending ? t("conversations.sending") : t("conversations.sendReply")}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                        {t("admin.whatsapp.conversations.selectConversation")}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="logs" className="mt-0">
              <WhatsAppLogs />
            </TabsContent>
            
            <TabsContent value="language-stats" className="mt-0">
              <LanguageStats isSuperAdmin={isSuperAdmin} />
            </TabsContent>

            {!isSuperAdmin && (
              <TabsContent value="integration" className="mt-0">
                <WhatsAppSettings />
              </TabsContent>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
};
