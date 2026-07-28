import { useState, useEffect, useMemo, useRef } from "react";
import { normalizePhone } from "@/utils/phone";
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
import { cn } from "@/lib/utils";
import {
  MessageCircle, User, Bot, Building2,
  Search, Settings, ChevronLeft, ChevronRight, Send, PauseCircle,
  PlayCircle, Loader2, Bell, Info, Maximize2, Minimize2,
} from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
// WhatsAppLogs and LanguageStats moved to Reporting menu (Admin.tsx routing)
import { WhatsAppSettings } from "./WhatsAppSettings";
import AgencySettings from "./AgencySettings";
import { EmptyState } from "./EmptyState";
import { ConversationsEmptyIllustration } from "./illustrations/ConversationsEmptyIllustration";

const PAGE_SIZE = 25;

interface Message {
  id: string;
  phone: string;
  role: string;
  content: string;
  created_at: string;
}

// BUG 8b (P2-A'da modül-seviyesine çıkarıldı — TEK KAYNAK): system/state-JSON
// mesajlarını filtrele. Tüketiciler: loadConversations + realtime INSERT handler.
const isSystemOrStateMsg = (msg: Message) => {
  if (msg.role === "system") return true;
  if (typeof msg.content === "string" && msg.content.trimStart().startsWith("{")) {
    try { const p = JSON.parse(msg.content); return typeof p === "object" && p !== null && "stage" in p; }
    catch { return false; }
  }
  return false;
};

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
  // P2-C (2026-07-28): tam-sayfa modu — aynı sayfada expand (route/pencere DEĞİL).
  const [isExpanded, setIsExpanded] = useState(false);
  // P2-A (2026-07-28): realtime okunmamış-vurgusu — seçili-olmayan konuşmaya yeni
  // user-mesajı düşünce telefonu bu set'e ekle; konuşma seçilince temizle.
  const [unseenPhones, setUnseenPhones] = useState<Set<string>>(new Set());
  // subscription-callback'te güncel seçimi okumak için ref (kanalı selectedPhone'a
  // bağlamamak için — yoksa her seçim kanal yeniden-kurardı).
  const selectedPhoneRef = useRef<string | null>(null);
  useEffect(() => { selectedPhoneRef.current = selectedPhone; }, [selectedPhone]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAgencies();
    } else {
      // Fetch current user's agencyId first, then load conversations with filter
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from("agencies").select("id").eq("user_id", user.id).single()
          .then(({ data }) => {
            if (data?.id) {
              setAgencyId(data.id);
              loadConversations(data.id);
            }
          });
      });
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (selectedAgencyId) {
      loadConversations(selectedAgencyId);
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
      .eq("phone", normalizePhone(selectedPhone.replace("whatsapp:", "")))
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

  // ── P2-A (2026-07-28): REALTIME — yeni mesajlar F5'siz düşer ────────────────
  // postgres_changes INSERT, agency-filtreli (RLS de agency-scoped: çifte emniyet).
  // DEDUPE: (1) aynı id zaten listedeyse SKIP (loadConversations re-fetch yarışı);
  // (2) kendi optimistic-insert'imizle (id "optimistic-*") content+role eşleşiyorsa
  // optimistic satır GERÇEK satırla DEĞİŞTİRİLİR (çift-görünüm imkânsız).
  // CLEANUP: effect-return removeChannel — unmount + aid-değişiminde (superadmin
  // acente değiştirince eski kanal kapanır, yenisi kurulur; memory-leak yok).
  // 24h-BANDI: bant render'da selectedConversation.messages'tan hesaplanıyor →
  // realtime-merge state'i güncelleyince pencere-durumu otomatik yeniden hesaplanır.
  useEffect(() => {
    const aid = isSuperAdmin ? selectedAgencyId : agencyId;
    if (!aid) return;
    const channel = supabase
      .channel(`wa-conv-${aid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_conversations", filter: `agency_id=eq.${aid}` },
        (payload) => {
          const msg = payload.new as Message;
          if (!msg?.id || isSystemOrStateMsg(msg)) return;
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.phone === msg.phone);
            if (idx === -1) {
              // Yeni konuşma — grup oluştur, en üste
              return [{ phone: msg.phone, messages: [msg], lastMessageTime: msg.created_at }, ...prev];
            }
            const conv = prev[idx];
            if (conv.messages.some((m) => m.id === msg.id)) return prev; // dedupe (1)
            const optIdx = conv.messages.findIndex(
              (m) => m.id.startsWith("optimistic-") && m.role === msg.role && m.content === msg.content,
            );
            const newMessages = optIdx !== -1
              ? conv.messages.map((m, i) => (i === optIdx ? msg : m)) // dedupe (2): replace
              : [...conv.messages, msg];
            const updated = { ...conv, messages: newMessages, lastMessageTime: msg.created_at };
            // Sol-liste yeniden-sıralama: son-mesajı olan en üste
            const rest = prev.filter((_, i) => i !== idx);
            return [updated, ...rest].sort(
              (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
            );
          });
          // Okunmamış-vurgu: seçili-olmayan konuşmaya USER-mesajı
          if (msg.role === "user" && selectedPhoneRef.current !== msg.phone) {
            setUnseenPhones((prev) => new Set(prev).add(msg.phone));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agencyId, selectedAgencyId, isSuperAdmin]);

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
      toast({ title: t("common.error"), description: t("common.loadError"), variant: "destructive" });
    }
  };

  const loadConversations = async (agencyIdOverride?: string) => {
    setLoading(true);
    try {
      const effectiveAgencyId = agencyIdOverride || (isSuperAdmin ? selectedAgencyId : agencyId);
      let query = supabase
        .from("whatsapp_conversations")
        .select("id, phone, role, content, created_at, agency_id")
        .order("created_at", { ascending: false });

      if (effectiveAgencyId) {
        query = query.eq("agency_id", effectiveAgencyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const visibleData = (data || []).filter((msg) => !isSystemOrStateMsg(msg));

      // Konuşmaları telefon numarasına göre grupla
      const grouped = visibleData.reduce((acc: Record<string, Message[]>, msg) => {
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
      toast({ title: t("common.error"), description: t("common.loadError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedPhone) return;
    const aid = isSuperAdmin ? selectedAgencyId : agencyId;
    if (!aid) return;

    // BUG FIX: Optimistic update — mesaj DB'ye yazılana kadar beklemeden UI'a ekle.
    // Önceden sadece `await loadConversations()` ile DB'den re-fetch ediyorduk;
    // DB insert SILENT FAIL ettiğinde (metadata kolonu yoktu) mesaj hiç görünmüyordu.
    // Şimdi: hemen ekle → fail olursa rollback. Migration ile DB insert de düzeldi.
    const _normalizedPhone = normalizePhone(selectedPhone.replace("whatsapp:", ""));
    const _trimmedMsg = replyMessage.trim();
    const _tempId = `optimistic-${Date.now()}`;
    const _tempMsg: Message = {
      id: _tempId,
      phone: _normalizedPhone,
      role: "assistant",
      content: _trimmedMsg,
      created_at: new Date().toISOString(),
    };
    // UI'da hemen göster — gönderim başarısız olursa filter ile çıkar
    setConversations((prev) => prev.map((conv) =>
      conv.phone === selectedPhone
        ? {
            ...conv,
            messages: [...conv.messages, _tempMsg],
            lastMessageTime: _tempMsg.created_at,
          }
        : conv
    ));

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-manual-message", {
        body: { agencyId: aid, phone: _normalizedPhone, message: _trimmedMsg },
      });
      if (error) throw error;

      // BUG FIX: DB insert fail durumunda edge function warning döner — gösterelim
      if (data?.warning === "DB_INSERT_FAILED") {
        console.warn("[send-manual-message] DB kayıt fail:", data?.warningDetail);
        toast({
          title: t("conversations.sendSuccess"),
          description: t("conversations.dbWarning", {
            defaultValue: "Mesaj WhatsApp'tan gönderildi ama panel kaydı yapılamadı.",
          }),
          variant: "destructive",
          duration: 7000,
        });
      } else {
        toast({ title: t("conversations.sendSuccess") });
      }

      setReplyMessage("");
      // Re-fetch — gerçek DB id ile değiştirsin (optimistic temp id yerine).
      // Eğer DB insert başarılıysa loadConversations gerçek mesajı getirir.
      // Argument olarak aid geç — state race condition önle.
      await loadConversations(aid);
    } catch (err: any) {
      // Rollback: optimistic eklenen mesajı kaldır
      setConversations((prev) => prev.map((conv) =>
        conv.phone === selectedPhone
          ? { ...conv, messages: conv.messages.filter((m) => m.id !== _tempId) }
          : conv
      ));
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
      // FIX (Y2-B): okuma tarafı normalizePhone kullanıyor — yazma da aynı kanonik
      // anahtarı kullanmalı; yoksa pause hayalet profile yazılıp hiç etki etmiyordu.
      const normalizedPhone = normalizePhone(selectedPhone.replace("whatsapp:", ""));
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
      // Madde 1: Ham err.message kullanıcıya sızmasın (Supabase auth/DB iç hataları teknik).
      // Konsol debug için tutulur; UI'da müşteri-dostu mesaj + destek yönlendirme.
      console.error("[bot-pause] toggle failed:", err?.message || err);
      toast({
        title: t("common.error"),
        description: t("common.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setBotPauseLoading(false);
    }
  };

  const handleSelectConversation = (phone: string) => {
    setSelectedPhone(phone);
    // P2-A: seçilince okunmamış-vurgusu temizlenir
    setUnseenPhones((prev) => {
      if (!prev.has(phone)) return prev;
      const next = new Set(prev); next.delete(phone); return next;
    });
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
      <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-6 overflow-x-hidden",
        // P2-C: expand'de modül panelin tüm alanını kaplar (overlay; layout'a dokunmaz,
        // diğer bölümler DOM'da yerinde kalır — kapatınca birebir eski görünüm).
        isExpanded && "fixed inset-0 z-50 bg-background p-4 overflow-y-auto"
      )}
    >
      <Tabs defaultValue="conversations" className="w-full">
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  {t("whatsapp.management.title")}
                  {/* P2-C: genişlet/daralt */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 ml-1"
                    onClick={() => setIsExpanded((v) => !v)}
                    title={isExpanded ? t("conversations.collapse") : t("conversations.expand")}
                  >
                    {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </CardTitle>

                {isSuperAdmin && agencies.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
                      <SelectTrigger className="w-full sm:w-[250px]">
                        <SelectValue placeholder={t("whatsapp.conversations.selectAgency")} />
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
              
              <TabsList className={`grid w-full ${isSuperAdmin ? "grid-cols-1" : "grid-cols-3"}`}>
                <TabsTrigger value="conversations" className="flex items-center gap-1 text-xs sm:text-sm">
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("whatsapp.tabs.conversations")}</span>
                </TabsTrigger>
                {!isSuperAdmin && (
                  <TabsTrigger value="integration" className="flex items-center gap-1 text-xs sm:text-sm">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("whatsapp.tabs.integration")}</span>
                  </TabsTrigger>
                )}
                {!isSuperAdmin && (
                  <TabsTrigger value="settings" className="flex items-center gap-1 text-xs sm:text-sm">
                    <Bell className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("whatsapp.tabs.settings", { defaultValue: "Ayarlar" })}</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
          </CardHeader>
          
          <CardContent>
            <TabsContent value="conversations" className="mt-0">
              {conversations.length === 0 ? (
                <EmptyState
                  illustration={<ConversationsEmptyIllustration className="w-36 h-36" />}
                  title={t("conversations.emptyTitle")}
                  description={t("conversations.emptyDescription")}
                />
              ) : (
                /* Two-panel: outer fixed-height gives flex-1 children a concrete height to fill.
                   P2-C: expand'de yükseklik viewport'a oturur (başlık+padding payı düşülür). */
                <div className={cn(
                  "flex rounded-lg border overflow-hidden divide-x divide-border",
                  isExpanded ? "h-[calc(100vh-230px)]" : "h-[600px]"
                )}>

                  {/* LEFT — conversation list */}
                  <div className={cn(
                    "flex flex-col flex-shrink-0 w-full md:w-72",
                    isMobile && mobileView === "detail" && "hidden"
                  )}>
                    {/* Search + count */}
                    <div className="flex flex-col gap-2 p-3 border-b flex-shrink-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                          placeholder={t("whatsapp.conversations.search")}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("whatsapp.conversations.count", { count: filteredConversations.length })}
                        {totalPages > 1 && ` · ${t("whatsapp.conversations.page", { current: currentPage, total: totalPages })}`}
                      </p>
                    </div>

                    {/* Scrollable list — flex-1 fills remaining height inside fixed-h parent */}
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="p-2 space-y-1">
                        {paginatedConversations.map((conv) => (
                          <button
                            key={conv.phone}
                            onClick={() => handleSelectConversation(conv.phone)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-colors",
                              selectedPhone === conv.phone
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted border-border"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <User className="h-4 w-4 shrink-0" />
                              <p className={cn("text-sm truncate", unseenPhones.has(conv.phone) ? "font-bold" : "font-medium")}>{conv.phone}</p>
                              {/* P2-A: okunmamış-vurgusu — seçili-olmayan konuşmaya yeni user-mesajı */}
                              {unseenPhones.has(conv.phone) && (
                                <span className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" aria-hidden />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {conv.messages.length} {t("admin.whatsapp.conversations.messages")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(conv.lastMessageTime), "dd MMM yyyy, HH:mm", { locale: tr })}
                            </p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Pagination — pinned to bottom of left panel */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between p-2 border-t flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* RIGHT — message area */}
                  <div className={cn(
                    "flex flex-col flex-1 min-w-0 min-h-0",
                    isMobile && mobileView === "list" && "hidden"
                  )}>
                    {/* Mobile back button */}
                    {isMobile && (
                      <div className="p-2 border-b flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMobileView("list")}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          {t("admin.back")}
                        </Button>
                      </div>
                    )}

                    {selectedConversation ? (
                      <>
                        {/* Messages — flex-1 takes all remaining height, scrolls inside */}
                        <ScrollArea className="flex-1 min-h-0">
                          <div className="p-4 space-y-3">
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
                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
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

                        {/* Takeover panel — flex-shrink-0 so it never steals space from messages */}
                        {!isSuperAdmin && (
                          <div className="flex-shrink-0 border-t p-3 space-y-2">
                            {/* P1-4 (2026-07-28): "WhatsApp'tan yaz" quick-link KALDIRILDI —
                                numara Cloud API'ye bağlı; wa.me/WhatsApp Web'den yazmak imkânsız,
                                buton yanıltıcıydı. Panel-içi gönderim (send-manual-message) tek yol. */}
                            <p className="text-xs text-muted-foreground truncate px-1">
                              <User className="h-3 w-3 inline mr-1" />
                              {selectedPhone}
                            </p>
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

                            {/* P1-5 (2026-07-28): Meta 24h-kuralı bilgi bandı — DİNAMİK.
                                Son müşteri(user)-mesajı zamanı state'te hazır (selectedConversation
                                .messages) → 24h penceresi hesaplanır: açıksa nötr bilgi-tonu,
                                kapalıysa (veya hiç user-mesajı yoksa) uyarı-tonu. */}
                            {(() => {
                              const _lastUser = [...selectedConversation.messages]
                                .reverse()
                                .find((m) => m.role === "user");
                              const _winOpen = !!_lastUser &&
                                Date.now() - new Date(_lastUser.created_at).getTime() < 24 * 60 * 60 * 1000;
                              return (
                                <div
                                  className={cn(
                                    "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
                                    _winOpen
                                      ? "bg-muted/40 text-muted-foreground"
                                      : "bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/30"
                                  )}
                                >
                                  <Info className="h-3.5 w-3.5 shrink-0 mt-[1px]" />
                                  <span>{_winOpen ? t("conversations.win24Info") : t("conversations.win24Warn")}</span>
                                </div>
                              );
                            })()}

                            {/* Reply textarea */}
                            <div className="space-y-2">
                              <Textarea
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                placeholder={t("conversations.replyPlaceholder")}
                                rows={2}
                                disabled={sending}
                                className="w-full resize-none text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    handleSendReply();
                                  }
                                }}
                              />
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground flex-1">{t("conversations.replyHint")}</p>
                                <Button
                                  size="sm"
                                  onClick={handleSendReply}
                                  disabled={!replyMessage.trim() || sending}
                                  className="flex-shrink-0 h-8"
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
            
            {!isSuperAdmin && (
              <TabsContent value="integration" className="mt-0">
                <WhatsAppSettings />
              </TabsContent>
            )}

            {!isSuperAdmin && (
              <TabsContent value="settings" className="mt-0">
                <AgencySettings />
              </TabsContent>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
};
