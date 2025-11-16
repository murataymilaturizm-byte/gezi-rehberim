import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const SupportChatWidget = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  const getInitialMessage = () => {
    const welcomeMessages: Record<string, string> = {
      tr: "Merhaba! Size nasıl yardımcı olabilirim? Sistem kullanımı, özellikler veya teknik konularda sorularınızı yanıtlayabilirim. 📚",
      en: "Hello! How can I help you? I can answer your questions about system usage, features, or technical topics. 📚",
      de: "Hallo! Wie kann ich Ihnen helfen? Ich kann Ihre Fragen zur Systemnutzung, zu Funktionen oder technischen Themen beantworten. 📚",
      ru: "Здравствуйте! Чем я могу помочь? Я могу ответить на ваши вопросы об использовании системы, функциях или технических темах. 📚",
      ar: "مرحبا! كيف يمكنني مساعدتك؟ يمكنني الإجابة على أسئلتك حول استخدام النظام أو الميزات أو المواضيع الفنية. 📚",
      fr: "Bonjour! Comment puis-je vous aider? Je peux répondre à vos questions sur l'utilisation du système, les fonctionnalités ou les sujets techniques. 📚",
      es: "¡Hola! ¿Cómo puedo ayudarte? Puedo responder tus preguntas sobre el uso del sistema, características o temas técnicos. 📚"
    };
    return welcomeMessages[i18n.language] || welcomeMessages.tr;
  };
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('support-chat-messages');
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

  // Dil değiştiğinde karşılama mesajını güncelle
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 0 || prev[0].role !== 'assistant') {
        return [{
          role: "assistant",
          content: getInitialMessage()
        }, ...prev];
      }
      return [{
        role: "assistant",
        content: getInitialMessage()
      }, ...prev.slice(1)];
    });
  }, [i18n.language]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  const getQuickReplies = () => {
    const quickReplies: Record<string, Array<{label: string, message: string}>> = {
      tr: [
        { label: "🚀 Kurulum", message: "Sistemi nasıl kurabilirim? WhatsApp bağlantısı nasıl yapılır?" },
        { label: "🎯 Turlar", message: "Tur nasıl eklerim? Tur tarihlerini nasıl yönetirim?" },
        { label: "📅 Rezervasyonlar", message: "Rezervasyonları nasıl yönetirim? Durum güncellemeleri nasıl yapılır?" },
        { label: "💬 WhatsApp Bot", message: "WhatsApp botu nasıl çalışır? Dil desteği nedir?" },
        { label: "🔧 Teknik Destek", message: "Teknik bir sorunla karşılaştım, yardım alabilir miyim?" }
      ],
      en: [
        { label: "🚀 Setup", message: "How can I set up the system? How to connect WhatsApp?" },
        { label: "🎯 Tours", message: "How do I add tours? How to manage tour dates?" },
        { label: "📅 Reservations", message: "How do I manage reservations? How to update statuses?" },
        { label: "💬 WhatsApp Bot", message: "How does the WhatsApp bot work? What is language support?" },
        { label: "🔧 Technical Support", message: "I have a technical issue, can I get help?" }
      ],
      de: [
        { label: "🚀 Einrichtung", message: "Wie kann ich das System einrichten? Wie verbinde ich WhatsApp?" },
        { label: "🎯 Touren", message: "Wie füge ich Touren hinzu? Wie verwalte ich Tourdaten?" },
        { label: "📅 Reservierungen", message: "Wie verwalte ich Reservierungen? Wie aktualisiere ich Status?" },
        { label: "💬 WhatsApp Bot", message: "Wie funktioniert der WhatsApp-Bot? Was ist Sprachunterstützung?" },
        { label: "🔧 Technischer Support", message: "Ich habe ein technisches Problem, kann ich Hilfe bekommen?" }
      ],
      ru: [
        { label: "🚀 Настройка", message: "Как настроить систему? Как подключить WhatsApp?" },
        { label: "🎯 Туры", message: "Как добавить туры? Как управлять датами туров?" },
        { label: "📅 Бронирования", message: "Как управлять бронированиями? Как обновить статусы?" },
        { label: "💬 WhatsApp Бот", message: "Как работает WhatsApp бот? Какая языковая поддержка?" },
        { label: "🔧 Техподдержка", message: "У меня техническая проблема, можно получить помощь?" }
      ],
      ar: [
        { label: "🚀 الإعداد", message: "كيف يمكنني إعداد النظام؟ كيف أربط WhatsApp؟" },
        { label: "🎯 الجولات", message: "كيف أضيف الجولات؟ كيف أدير تواريخ الجولات؟" },
        { label: "📅 الحجوزات", message: "كيف أدير الحجوزات؟ كيف أحدث الحالات؟" },
        { label: "💬 بوت WhatsApp", message: "كيف يعمل بوت WhatsApp؟ ما هو دعم اللغات؟" },
        { label: "🔧 الدعم الفني", message: "لدي مشكلة تقنية، هل يمكنني الحصول على المساعدة؟" }
      ],
      fr: [
        { label: "🚀 Configuration", message: "Comment configurer le système? Comment connecter WhatsApp?" },
        { label: "🎯 Visites", message: "Comment ajouter des visites? Comment gérer les dates?" },
        { label: "📅 Réservations", message: "Comment gérer les réservations? Comment mettre à jour les statuts?" },
        { label: "💬 Bot WhatsApp", message: "Comment fonctionne le bot WhatsApp? Quel est le support linguistique?" },
        { label: "🔧 Support Technique", message: "J'ai un problème technique, puis-je obtenir de l'aide?" }
      ],
      es: [
        { label: "🚀 Configuración", message: "¿Cómo configuro el sistema? ¿Cómo conecto WhatsApp?" },
        { label: "🎯 Tours", message: "¿Cómo agrego tours? ¿Cómo gestiono las fechas de tours?" },
        { label: "📅 Reservas", message: "¿Cómo gestiono las reservas? ¿Cómo actualizo estados?" },
        { label: "💬 Bot WhatsApp", message: "¿Cómo funciona el bot de WhatsApp? ¿Qué es el soporte de idiomas?" },
        { label: "🔧 Soporte Técnico", message: "Tengo un problema técnico, ¿puedo obtener ayuda?" }
      ]
    };
    return quickReplies[i18n.language] || quickReplies.tr;
  };

  useEffect(() => {
    localStorage.setItem('support-chat-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuickReply = (message: string) => {
    setInput(message);
    setShowQuickReplies(false);
    // Hemen gönder
    const userMessage: Message = { role: "user", content: message };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    supabase.functions.invoke("support-chat", {
      body: { 
        message: message, 
        conversationHistory: messages,
        language: i18n.language 
      }
    }).then(({ data, error }) => {
      if (error) throw error;
      const assistantMessage: Message = {
        role: "assistant",
        content: data.response
      };
      setMessages(prev => [...prev, assistantMessage]);
    }).catch(error => {
      console.error("Error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Özür dilerim, bir hata oluştu. Lütfen tekrar deneyin veya detaylı yardım için /yardim sayfasını ziyaret edin ya da info@turzz.ai adresinden bizimle iletişime geçin."
      }]);
    }).finally(() => {
      setIsLoading(false);
    });
  };

  const handleSend = async () => {
    const messageToSend = input.trim();
    if (!messageToSend || isLoading) return;

    const userMessage: Message = { role: "user", content: messageToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setShowQuickReplies(false);

    try {
      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: { 
          message: messageToSend, 
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
        content: "Özür dilerim, bir hata oluştu. Lütfen tekrar deneyin veya detaylı yardım için /yardim sayfasını ziyaret edin ya da info@turzz.ai adresinden bizimle iletişime geçin."
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
          className="h-16 w-16 rounded-full shadow-elegant hover:shadow-glow bg-gradient-to-br from-secondary to-secondary/80 hover:opacity-90 transition-all duration-300"
        >
          <HelpCircle className="h-7 w-7" />
        </Button>
      ) : (
        <Card className="w-[380px] h-[600px] shadow-elegant flex flex-col animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-secondary to-secondary/80 p-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Turzz Yardım & Destek</h3>
                <p className="text-xs text-white/80">Size yardımcı olmak için buradayız</p>
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
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Sorunuzu yazın..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="bg-secondary hover:bg-secondary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Detaylı bilgi için{" "}
              <a href="/yardim" className="text-primary hover:underline" target="_blank">
                Yardım Merkezi
              </a>
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
