import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Bot, User, RotateCcw, X, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const DemoChat = () => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();

  const [sessionId, setSessionId] = useState(() => {
    // Create or get existing session ID with timestamp check
    const stored = localStorage.getItem("demo_chat_session_id");
    const timestamp = localStorage.getItem("demo_chat_session_timestamp");
    
    // Session timeout: 1 hour
    const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds
    
    if (stored && timestamp) {
      const sessionAge = Date.now() - parseInt(timestamp);
      if (sessionAge < SESSION_TIMEOUT) {
        return stored; // Session still valid
      }
    }
    
    // Create new session
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("demo_chat_session_id", newId);
    localStorage.setItem("demo_chat_session_timestamp", Date.now().toString());
    localStorage.removeItem("demo-chat-messages"); // Clear old messages
    return newId;
  });

  const [conversationStyle, setConversationStyle] = useState<
    "standart" | "kurumsal" | "dinamik" | "premium"
  >(() => {
    const savedStyle = localStorage.getItem("demo-chat-style");
    if (
      savedStyle === "standart" ||
      savedStyle === "kurumsal" ||
      savedStyle === "dinamik" ||
      savedStyle === "premium"
    ) {
      return savedStyle;
    }
    return "standart";
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("demo-chat-messages");
    const savedLang = localStorage.getItem("demo-chat-language");
    const savedStyle = localStorage.getItem("demo-chat-style");

    if (
      saved &&
      savedLang === i18n.language &&
      savedStyle &&
      (savedStyle === "standart" ||
        savedStyle === "kurumsal" ||
        savedStyle === "dinamik" ||
        savedStyle === "premium")
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
  // Retry sırasında "Yanıt hazırlanıyor..." metnini loading bubble içinde göstermek için.
  // Safari "Load failed" (cold start + zayıf ağ) durumunda sessiz retry — kullanıcı hata yerine bekleme görür.
  const [isRetrying, setIsRetrying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversationState, setConversationState] = useState<any>(null);

  // Eski scroll mantığına dönüş: ScrollArea'ya ref
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previousLanguageRef = useRef(i18n.language);

  // 2026-06-26: Input focus korunması.
  // Sorun: <Input disabled={isLoading} ... /> — cevap beklerken disabled
  // toggle focus'u DÜŞÜRÜYORDU. isLoading false olunca enable AMA tarayıcı
  // focus'u geri vermiyor → kullanıcı her cevap sonrası input'a tıklamak
  // zorunda kalıyordu. Fix: ref + useEffect [isLoading] ile true→false
  // geçişinde focus restore. Mobilde atla (iOS klavye spam'i — kullanıcı
  // bot cevabını okurken klavye sürekli açılmasın).
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("demo-chat-messages", JSON.stringify(messages));
    localStorage.setItem("demo-chat-language", i18n.language);
    localStorage.setItem("demo-chat-style", conversationStyle);
  }, [messages, i18n.language, conversationStyle]);

  // Dil değiştiğinde konuşmaları temizle ve session'ı sıfırla
  useEffect(() => {
    if (previousLanguageRef.current !== i18n.language) {
      console.log('Dil değişti:', previousLanguageRef.current, '->', i18n.language);
      // Dil değişti, konuşmaları temizle
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem("demo_chat_session_id", newSessionId);
      localStorage.setItem("demo_chat_session_timestamp", Date.now().toString()); // Update timestamp
      
      const getStyledGreeting = () => {
        const baseGreeting = t("demo.greeting");
        switch (conversationStyle) {
          case "standart":
            return baseGreeting + "\n\n" + t("demo.helpPrompt.standart");
          case "kurumsal":
            return baseGreeting + "\n\n" + t("demo.helpPrompt.kurumsal");
          case "dinamik":
            return baseGreeting + "\n\n" + t("demo.helpPrompt.dinamik");
          case "premium":
            return baseGreeting + "\n\n" + t("demo.helpPrompt.premium");
          default:
            return baseGreeting + "\n\n" + t("demo.helpPrompt.standart");
        }
      };
      
      setMessages([{ role: "assistant", content: getStyledGreeting() }]);
      setConversationState(null);
      
      // Ref'i güncelle
      previousLanguageRef.current = i18n.language;
    }
  }, [i18n.language, conversationStyle, t, setSessionId]);

  // Stil değiştiğinde sadece greeting'i güncelle
  useEffect(() => {
    const getStyledGreeting = () => {
      const baseGreeting = t("demo.greeting");
      switch (conversationStyle) {
        case "standart":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.standart");
        case "kurumsal":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.kurumsal");
        case "dinamik":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.dinamik");
        case "premium":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.premium");
        default:
          return baseGreeting + "\n\n" + t("demo.helpPrompt.standart");
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
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  // 2026-06-26: Cevap geldikten sonra focus restore (desktop only).
  // isLoading true→false geçişini wasLoadingRef ile takip ederek SADECE
  // gerçek bir gönderim sonrası tetikle (ilk mount'ta sayfa açılışı focus'a
  // düşmesin — kullanıcı bot greeting'i okurken klavye açılmasın).
  // requestAnimationFrame: disabled=false render edildikten SONRA focus ver
  // (disabled iken focus() etkisiz — React commit sırasında DOM güncellemesi
  // henüz tamamlanmamış olabilir).
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && !isMobile) {
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      wasLoadingRef.current = false;
      return () => cancelAnimationFrame(id);
    }
    if (isLoading) {
      wasLoadingRef.current = true;
    }
  }, [isLoading, isMobile]);

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

    // ─── Retry + backoff sarmalı ───────────────────────────────────────────
    // Safari/iOS WebKit "Load failed" → native fetch'in TypeError'ı (cold start,
    // zayıf ağ, preflight kesintisi). Toplam 3 deneme: 1 ilk + 2 retry.
    // Backoff: retry-1 öncesi 500ms, retry-2 öncesi 1500ms.
    // Retry yalnızca fetch'in kendisi exception fırlatırsa (response objesi
    // hiç dönmediyse) tetiklenir. HTTP yanıtı geldiyse — 200/4xx/5xx — mevcut
    // davranış aynen korunur (response.ok kontrolü vs.).
    const isNetworkError = (err: unknown): boolean => {
      if (!(err instanceof TypeError)) return false;
      const m = err.message || "";
      return m.includes("Load failed") || m.includes("Failed to fetch") || m.includes("NetworkError");
    };

    const backoffsMs = [500, 1500];
    let response: Response | null = null;
    let lastNetworkErr: unknown = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        setIsRetrying(true);
        await new Promise((r) => setTimeout(r, backoffsMs[attempt - 1]));
      }
      try {
        response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            message: userMessage,
            sessionId: sessionId,
            conversationStyle: conversationStyle,
            conversationState: conversationState,
            // FIX: Kullanıcının demo dropdown'ından seçtiği dil — backend tahmin etmek yerine bunu öncelik alır.
            // Aksi halde ilk mesajda ASCII İngilizce/diğer için detection fail edip TR'ye düşüyordu.
            language: i18n.language,
          }),
        });
        // Fetch resolved (HTTP yanıtı geldi) — retry'a düşmüyoruz, response.ok mevcut akışta değerlendirilecek.
        break;
      } catch (err) {
        if (isNetworkError(err) && attempt < 2) {
          lastNetworkErr = err;
          continue;
        }
        // Network-error olmayan exception VEYA 3. denemenin network error'ı:
        // response null kalır, aşağıdaki ortak hata yolu mevcut catch davranışını uygular.
        lastNetworkErr = err;
        break;
      }
    }
    setIsRetrying(false);

    if (!response) {
      // Tüm denemeler başarısız (network error ya da non-network exception).
      // Mevcut hata davranışı: toast + user mesajını slice ile geri al.
      const err = lastNetworkErr instanceof Error ? lastNetworkErr : new Error("Mesaj gönderilemedi");
      console.error("Chat error:", err);
      toast({
        title: "Hata",
        description: err.message || "Mesaj gönderilemedi",
        variant: "destructive",
        duration: 5000,
      });
      setMessages((prev) => prev.slice(0, -1));
      setIsLoading(false);
      return;
    }

    try {
      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = "Yanıt alınamadı";
        let errorDetails = "";

        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.error || errorMsg;
          errorDetails = errorData.details || "";
        } catch {
          errorDetails = errorText;
        }

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
    localStorage.setItem("demo_chat_session_timestamp", Date.now().toString()); // Update timestamp
    localStorage.removeItem("demo-chat-messages");
    setConversationState(null); // Reset conversation state

    const getStyledGreeting = () => {
      const baseGreeting = t("demo.greeting");
      switch (conversationStyle) {
        case "standart":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.standart");
        case "kurumsal":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.kurumsal");
        case "dinamik":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.dinamik");
        case "premium":
          return baseGreeting + "\n\n" + t("demo.helpPrompt.premium");
        default:
          return baseGreeting + "\n\n" + t("demo.helpPrompt.standart");
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
    <div className={`${isExpanded && isMobile ? "fixed inset-0 z-[60] bg-background p-4 animate-scale-in" : "container mx-auto py-4 sm:py-8 px-4"}`}>
      {/* Outer glow wrapper — premium gradient halka */}
      <div className={`${isExpanded && isMobile ? "h-full" : "max-w-2xl mx-auto"} relative`}>
        {/* Subtle outer glow ring (mobilde daha hafif) */}
        <div className="absolute -inset-0.5 bg-gradient-ocean rounded-xl blur-md opacity-20 sm:opacity-30 pointer-events-none" aria-hidden="true" />
      <Card
        className={`${isExpanded && isMobile ? "h-full" : ""} relative border-border/50 shadow-card flex flex-col overflow-hidden backdrop-blur-sm`}
      >
        <CardHeader className="border-b border-border bg-gradient-ocean flex-shrink-0 relative overflow-hidden">
          {/* Decorative shimmer behind header */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_60%)] pointer-events-none" aria-hidden="true" />
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-md ring-2 ring-white/30">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                {/* Online pulse dot */}
                <span className="absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full bg-green-400 ring-2 ring-[hsl(16_95%_55%)]">
                  <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-70" />
                </span>
              </div>
              <div>
                <CardTitle className="text-primary-foreground flex items-center gap-1.5">
                  TurzzAI Demo
                  <Sparkles className="w-4 h-4 text-primary-foreground/80" />
                </CardTitle>
                <p className="text-xs text-primary-foreground/80 flex items-center gap-1">
                  {t("demo.aiOnline")}
                </p>
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
                onValueChange={(value: "standart" | "kurumsal" | "dinamik" | "premium") =>
                  setConversationStyle(value)
                }
              >
                <SelectTrigger
                  className={`${isMobile ? "w-[110px] text-xs" : "w-[180px]"} bg-background text-foreground`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standart">✨ {t("demo.style.standart")}</SelectItem>
                  <SelectItem value="kurumsal">👔 {t("demo.style.kurumsal")}</SelectItem>
                  <SelectItem value="dinamik">⚡ {t("demo.style.dinamik")}</SelectItem>
                  <SelectItem value="premium">💎 {t("demo.style.premium")}</SelectItem>
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
          <ScrollArea
            className={`${isExpanded && isMobile ? "flex-1" : "h-[340px] sm:h-[400px] max-h-[60vh]"} p-4`}
            ref={scrollRef}
            style={{
              backgroundImage:
                "radial-gradient(hsl(var(--primary) / 0.04) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          >
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-gradient-ocean flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-primary/20">
                        <MessageSquare className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
                        msg.role === "user"
                          ? "bg-gradient-ocean text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border/60 text-foreground rounded-bl-sm"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-3 justify-start"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-ocean flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-primary/30">
                      <MessageSquare className="w-4 h-4 text-primary-foreground animate-pulse" />
                    </div>
                    <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dot-1" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dot-2" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dot-3" />
                      </div>
                      {isRetrying && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {t("demo.preparing", { defaultValue: "Yanıt hazırlanıyor..." })}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-border bg-card/50 flex-shrink-0">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("demo.inputPlaceholder")}
                  disabled={isLoading}
                  className="h-12 md:h-11 pr-3 border-border/50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all duration-200 focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
                />
              </div>
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-ocean hover:opacity-90 h-12 w-12 md:h-11 md:w-11 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
                aria-label={t("demo.sendButton", "Send")}
              >
                <Send className="w-5 h-5 md:w-4 md:h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {t("demo.disclaimer")}
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};
