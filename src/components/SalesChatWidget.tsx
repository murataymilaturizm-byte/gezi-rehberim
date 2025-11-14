import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const SalesChatWidget = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  const getInitialMessage = () => {
    const welcomeMessages: Record<string, string> = {
      tr: "Merhaba! Turzz AI hakkında size nasıl yardımcı olabilirim? Fiyatlandırma, özellikler veya demo hakkında bilgi almak ister misiniz?",
      en: "Hello! How can I help you with Turzz AI? Would you like information about pricing, features, or a demo?",
      de: "Hallo! Wie kann ich Ihnen bei Turzz AI helfen? Möchten Sie Informationen zu Preisen, Funktionen oder einer Demo erhalten?",
      ru: "Здравствуйте! Чем я могу помочь вам с Turzz AI? Хотите узнать о ценах, функциях или демо-версии?",
      ar: "مرحبا! كيف يمكنني مساعدتك مع Turzz AI؟ هل ترغب في معلومات حول الأسعار أو الميزات أو العرض التوضيحي؟",
      fr: "Bonjour! Comment puis-je vous aider avec Turzz AI? Souhaitez-vous des informations sur les tarifs, les fonctionnalités ou une démonstration?",
      es: "¡Hola! ¿Cómo puedo ayudarte con Turzz AI? ¿Te gustaría información sobre precios, características o una demostración?"
    };
    return welcomeMessages[i18n.language] || welcomeMessages.tr;
  };
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('sales-chat-messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    return [
      {
        role: "assistant",
        content: getInitialMessage()
      }
    ];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('sales-chat-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("sales-chat", {
        body: { 
          message: input, 
          conversationHistory: messages,
          language: i18n.language 
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Özür dilerim, bir hata oluştu. Lütfen tekrar deneyin veya info@turzz.ai adresinden bizimle iletişime geçin."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="h-16 w-16 rounded-full shadow-elegant hover:shadow-glow bg-gradient-ocean hover:opacity-90 transition-all duration-300"
        >
          <MessageCircle className="h-7 w-7" />
        </Button>
      ) : (
        <Card className="w-[380px] h-[600px] shadow-elegant flex flex-col animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-gradient-ocean p-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Turzz AI Satış Desteği</h3>
                <p className="text-xs text-white/80">Online - Size yardımcı olalım</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.role === "user"
                        ? "bg-gradient-ocean text-white"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
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
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="bg-gradient-ocean hover:opacity-90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              WhatsApp desteği için: +90 XXX XXX XX XX
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
