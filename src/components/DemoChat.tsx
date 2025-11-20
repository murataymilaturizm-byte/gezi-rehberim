import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Bot, User, RotateCcw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const DemoChat = () => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();

  const [sessionId, setSessionId] = useState(() => {
    // Create or get existing session ID
    const stored = localStorage.getItem("demo_chat_session_id");
    if (stored) return stored;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("demo_chat_session_id", newId);
    return newId;
  });

  const [conversationStyle, setConversationStyle] = useState<
    "basic" | "friendly" | "professional" | "energetic" | "helpful"
  >(() => {
    const savedStyle = localStorage.getItem("demo-chat-style");
    if (
      savedStyle === "basic" ||
      savedStyle === "friendly" ||
      savedStyle === "professional" ||
      savedStyle === "energetic" ||
      savedStyle === "helpful"
    ) {
      return savedStyle;
    }
    return "basic";
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("demo-chat-messages");
    const savedLang = localStorage.getItem("demo-chat-language");
    const savedStyle = localStorage.getItem("demo-chat-style");

    if (
      saved &&
      savedLang === i18n.language &&
      savedStyle &&
      (savedStyle === "basic" ||
        savedStyle === "friendly" ||
        savedStyle === "professional" ||
        savedStyle === "energetic" ||
        savedStyle === "helpful")
    ) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved messages:", e);
      }
    }

    // Başlangıçta sadece greeting ile başla, effect ilk seferde stil ekleyecek
    return [
      {
        role: "assistant",
        content: t("demo.greeting"),
      },
    ];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversationState, setConversationState] = useState<any>(null);

  // Eski scroll mantığına dönüş: ScrollArea'ya ref
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem("demo-chat-messages", JSON.stringify(messages));
    localStorage.setItem("demo-chat-language", i18n.language);
    localStorage.setItem("demo-chat-style", conversationStyle);
  }, [messages, i18n.language, conversationStyle]);

  // Dil değiştiğinde konuşmaları temizle ve session'ı sıfırla
  useEffect(() => {
    const savedLang = localStorage.getItem("demo-chat-language");
    if (savedLang && savedLang !== i18n.language) {
      // Dil değişti, konuşmaları temizle
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem("demo_chat_session_id", newSessionId);
      
      const getStyledGreeting = () => {
        const baseGreeting = t("demo.greeting");
        switch (conversationStyle) {
          case "basic":
            return baseGreeting + "\n\n" + t("demo.helpPrompt.basic");
          case "friendly":
            return baseGreeting + "\n\n" + t("demo.helpPrompt.friendly");
          case "energetic":
            return baseGreeting + "\n\n" + t("demo.helpPrompt.energetic");
          case "helpful":
            return baseGreeting + "\n\n" + t("demo.helpPrompt.helpful");
          default: // professional
            return baseGreeting + "\n\n" + t("demo.helpPrompt.professional");
        }
      };
      
      setMessages([{ role: "assistant", content: getStyledGreeting() }]);
      setConversationState(null);
    }
  }, [i18n.language, conversationStyle, t]);

  // Stil değiştiğinde sadece greeting'i güncelle
  useEffect(() => {
    const getStyledGreeting = () => {
      const baseGreeting = t("demo.greeting");
      switch (conversationStyle) {
        case "basic":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.basic");
        case "friendly":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.friendly");
        case "energetic":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.energetic");
        case "helpful":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.helpful");
        default: // professional
          return baseGreeting + "\n\n" + t("demo.helpPrompt.professional");
      }
    };

    setMessages((prev) => {
      const hasUserMessages = prev.some((m) => m.role === "user");
      if (hasUserMessages) {
        // Kullanıcı zaten yazışmaya başladıysa, sohbeti bozma
        return prev;
      }
      // Sadece greeting olan durumda yeni greeting ile değiştir
      return [
        {
          role: "assistant",
          content: getStyledGreeting(),
        },
      ];
    });
  }, [i18n.language, conversationStyle, t]);

  // Her yeni mesajda ScrollArea'nın en altına git (eski davranış)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");

    // Expand to fullscreen on mobile when first message is sent
    if (isMobile && !isExpanded) {
      setIsExpanded(true);
    }

    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionId,
          conversationStyle: conversationStyle === "basic" ? "professional" : conversationStyle,
          conversationState: conversationState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.error || "Yanıt alınamadı";
        const errorDetails = errorData.details || "";
        throw new Error(errorDetails ? `${errorMsg}\n${errorDetails}` : errorMsg);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response || data.message }]);

      // Update conversation state from server response
      if (data.conversationState) {
        setConversationState(data.conversationState);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Mesaj gönderilemedi";

      toast({
        title: "Hata",
        description: errorMessage,
        variant: "destructive",
        duration: 5000, // Show for 5 seconds so user can read it
      });

      // Remove user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetConversation = () => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    localStorage.setItem("demo_chat_session_id", newSessionId);
    localStorage.removeItem("demo-chat-messages");
    setConversationState(null); // Reset conversation state

    const getStyledGreeting = () => {
      const baseGreeting = t("demo.greeting");
      switch (conversationStyle) {
        case "basic":
          return baseGreeting + "\n\n📍 Nasıl yardımcı olabilirim?";
        case "friendly":
          return baseGreeting + "\n\n😊 Sana nasıl yardımcı olabilirim?";
        case "energetic":
          return baseGreeting + "\n\n⚡ Harika turlarımızı keşfetmeye hazır mısın?! 🚀";
        case "helpful":
          return baseGreeting + "\n\n📝 Size yardımcı olmak için buradayım. Sorularınızı çekinmeden sorabilirsiniz.";
        default:
          return baseGreeting + "\n\n📍 Size nasıl yardımcı olabilirim?";
      }
    };

    setMessages([
      {
        role: "assistant",
        content: getStyledGreeting(),
      },
    ]);

    // Exit fullscreen mode
    setIsExpanded(false);

    toast({
      title: t("demo.resetSuccess"),
      description: t("demo.resetSuccessDesc"),
    });
  };

  return (
    <div className={`${isExpanded && isMobile ? "fixed inset-4 z-50 animate-scale-in" : "container mx-auto py-8"}`}>
      <Card
        className={`${isExpanded && isMobile ? "h-full" : "max-w-2xl mx-auto"} border-border shadow-card flex flex-col`}
      >
        <CardHeader className="border-b border-border bg-gradient-ocean flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-primary-foreground">TurzzAI Demo</CardTitle>
                <p className="text-sm text-primary-foreground/80">{t("demo.subtitle2")}</p>
              </div>
            </div>
            <div className={`flex items-center ${isMobile ? "flex-wrap gap-1.5" : "gap-2"}`}>
              {isExpanded && isMobile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  className="bg-background text-foreground hover:bg-background/80"
                  title="Kapat"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
              <Select
                value={conversationStyle}
                onValueChange={(value: "basic" | "friendly" | "professional" | "energetic" | "helpful") =>
                  setConversationStyle(value)
                }
              >
                <SelectTrigger
                  className={`${isMobile ? "w-[110px] text-xs" : "w-[180px]"} bg-background text-foreground`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">✨ {t("demo.style.basic")}</SelectItem>
                  <SelectItem value="friendly">🤝 {t("demo.style.friendly")}</SelectItem>
                  <SelectItem value="professional">👔 {t("demo.style.professional")}</SelectItem>
                  <SelectItem value="energetic">⚡ {t("demo.style.energetic")}</SelectItem>
                  <SelectItem value="helpful">😊 {t("demo.style.helpful")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size={isMobile ? "sm" : "icon"}
                onClick={resetConversation}
                className="bg-background text-foreground hover:bg-background/80"
                title={t("demo.resetChat")}
              >
                <RotateCcw className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
              </Button>
              <LanguageSelector />
            </div>
          </div>
        </CardHeader>
        <CardContent className={`p-0 flex flex-col ${isExpanded && isMobile ? "flex-1 min-h-0" : ""}`}>
          <ScrollArea className={`${isExpanded && isMobile ? "flex-1" : "h-[400px]"} p-4`} ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-ocean flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-gradient-ocean flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-primary-foreground animate-pulse" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-3 animate-scale-in">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-muted-foreground font-medium">
                        {t("demo.typing") || "Yazıyor..."}
                      </span>
                      <div className="flex gap-1">
                        <div
                          className="w-2 h-2 bg-primary rounded-full animate-bounce"
                          style={{
                            animationDelay: "0ms",
                            animationDuration: "1s",
                          }}
                        />
                        <div
                          className="w-2 h-2 bg-primary rounded-full animate-bounce"
                          style={{
                            animationDelay: "200ms",
                            animationDuration: "1s",
                          }}
                        />
                        <div
                          className="w-2 h-2 bg-primary rounded-full animate-bounce"
                          style={{
                            animationDelay: "400ms",
                            animationDuration: "1s",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-border flex-shrink-0">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Mesajınızı yazın..."
                disabled={isLoading}
                className="flex-1 h-12 md:h-10"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-ocean hover:opacity-90 h-12 w-12 md:h-10 md:w-10"
              >
                <Send className="w-5 h-5 md:w-4 md:h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Bu bir demo chatbot'tur. Gerçek tur verileri göstermez.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
