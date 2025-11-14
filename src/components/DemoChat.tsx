import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Bot, User, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const DemoChat = () => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [sessionId] = useState(() => {
    // Create or get existing session ID
    const stored = localStorage.getItem('demo_chat_session_id');
    if (stored) return stored;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('demo_chat_session_id', newId);
    return newId;
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('demo-chat-messages');
    const savedLang = localStorage.getItem('demo-chat-language');
    const savedStyle = localStorage.getItem('demo-chat-style');
    
    if (saved && savedLang === i18n.language && savedStyle) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    return [
      {
        role: "assistant",
        content: t("demo.greeting")
      }
    ];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationStyle, setConversationStyle] = useState<'friendly' | 'professional' | 'energetic' | 'helpful'>('professional');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('demo-chat-messages', JSON.stringify(messages));
    localStorage.setItem('demo-chat-language', i18n.language);
    localStorage.setItem('demo-chat-style', conversationStyle);
  }, [messages, i18n.language, conversationStyle]);

  // Update greeting when language or conversation style changes
  useEffect(() => {
    const getStyledGreeting = () => {
      const baseGreeting = t("demo.greeting");
      switch(conversationStyle) {
        case 'friendly':
          return baseGreeting + "\n\n😊 Sana nasıl yardımcı olabilirim?";
        case 'energetic':
          return baseGreeting + "\n\n⚡ Harika turlarımızı keşfetmeye hazır mısın?! 🚀";
        case 'helpful':
          return baseGreeting + "\n\n📝 Size yardımcı olmak için buradayım. Sorularınızı çekinmeden sorabilirsiniz.";
        default: // professional
          return baseGreeting + "\n\n📍 Size nasıl yardımcı olabilirim?";
      }
    };
    
    setMessages([
      {
        role: "assistant",
        content: getStyledGreeting()
      }
    ]);
  }, [i18n.language, conversationStyle, t]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            message: userMessage,
            history: messages.slice(-10),
            sessionId: sessionId,
            language: i18n.language,
            conversationStyle: conversationStyle
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Yanıt alınamadı");
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Mesaj gönderilemedi",
        variant: "destructive",
      });
      // Remove user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetConversation = () => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('demo_chat_session_id', newSessionId);
    localStorage.removeItem('demo-chat-messages');
    
    const getStyledGreeting = () => {
      const baseGreeting = t("demo.greeting");
      switch(conversationStyle) {
        case 'friendly':
          return baseGreeting + "\n\n😊 Sana nasıl yardımcı olabilirim?";
        case 'energetic':
          return baseGreeting + "\n\n⚡ Harika turlarımızı keşfetmeye hazır mısın?! 🚀";
        case 'helpful':
          return baseGreeting + "\n\n📝 Size yardımcı olmak için buradayım. Sorularınızı çekinmeden sorabilirsiniz.";
        default:
          return baseGreeting + "\n\n📍 Size nasıl yardımcı olabilirim?";
      }
    };
    
    setMessages([{
      role: "assistant",
      content: getStyledGreeting()
    }]);
    
    toast({
      title: t("demo.resetSuccess"),
      description: t("demo.resetSuccessDesc"),
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-border shadow-card">
      <CardHeader className="border-b border-border bg-gradient-ocean">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-primary-foreground">TurzzAI Demo</CardTitle>
              <p className="text-sm text-primary-foreground/80">
                {t("demo.subtitle2")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={conversationStyle}
              onValueChange={(value: 'friendly' | 'professional' | 'energetic' | 'helpful') => setConversationStyle(value)}
            >
              <SelectTrigger className="w-[180px] bg-background text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">🤝 {t("demo.style.friendly")}</SelectItem>
                <SelectItem value="professional">👔 {t("demo.style.professional")}</SelectItem>
                <SelectItem value="energetic">⚡ {t("demo.style.energetic")}</SelectItem>
                <SelectItem value="helpful">😊 {t("demo.style.helpful")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={resetConversation}
              className="bg-background text-foreground hover:bg-background/80"
              title={t("demo.resetChat")}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <LanguageSelector />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-ocean flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
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
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-ocean flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Mesajınızı yazın..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-gradient-ocean hover:opacity-90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Bu bir demo chatbot'tur. Gerçek tur verileri göstermez.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
