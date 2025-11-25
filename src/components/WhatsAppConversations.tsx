import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, User, Bot, Building2, ScrollText, Languages } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { WhatsAppLogs } from "./WhatsAppLogs";
import { LanguageStats } from "./LanguageStats";

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
  const [conversations, setConversations] = useState<ConversationGroup[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");

  useEffect(() => {
    if (isSuperAdmin) {
      loadAgencies();
    } else {
      loadConversations();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (selectedAgencyId) {
      loadConversations();
    }
  }, [selectedAgencyId]);

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

  const selectedConversation = conversations.find(c => c.phone === selectedPhone);

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
              
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="conversations" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Konuşmalar
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4" />
                  Loglar
                </TabsTrigger>
                <TabsTrigger value="language-stats" className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Dil İstatistikleri
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          
          <CardContent>
            <TabsContent value="conversations" className="mt-0">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("admin.whatsapp.conversations.selectConversation")}
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Sol taraf - Konuşma listesi */}
                  <div className="md:col-span-1 space-y-2">
                    <ScrollArea className="h-[600px] pr-4">
                      {conversations.map((conv) => (
                        <button
                          key={conv.phone}
                          onClick={() => setSelectedPhone(conv.phone)}
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
                  </div>

                  {/* Sağ taraf - Mesajlar */}
                  <div className="md:col-span-2">
                    {selectedConversation ? (
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-3">
                          {selectedConversation.messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex gap-3 ${
                                msg.role === "user" ? "justify-start" : "justify-end"
                              }`}
                            >
                              <div
                                className={`flex gap-2 max-w-[80%] ${
                                  msg.role === "user" ? "flex-row" : "flex-row-reverse"
                                }`}
                              >
                                <div
                                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                    msg.role === "user"
                                      ? "bg-secondary"
                                      : "bg-primary"
                                  }`}
                                >
                                  {msg.role === "user" ? (
                                    <User className="h-4 w-4 text-secondary-foreground" />
                                  ) : (
                                    <Bot className="h-4 w-4 text-primary-foreground" />
                                  )}
                                </div>
                                <div
                                  className={`rounded-lg p-3 ${
                                    msg.role === "user"
                                      ? "bg-secondary text-secondary-foreground"
                                      : "bg-primary text-primary-foreground"
                                  }`}
                                >
                                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                  <p
                                    className={`text-xs mt-1 ${
                                      msg.role === "user"
                                        ? "text-secondary-foreground/60"
                                        : "text-primary-foreground/60"
                                    }`}
                                  >
                                    {format(new Date(msg.created_at), "HH:mm", { locale: tr })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="h-[600px] flex items-center justify-center text-muted-foreground">
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
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
};
