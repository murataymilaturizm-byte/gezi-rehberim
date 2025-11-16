import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2, HelpCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: getInitialMessage()
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  // Dil değiştiğinde karşılama mesajını güncelle
  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: getInitialMessage()
    }]);
  }, [i18n.language]);

  const getQuickReplies = () => {
    const quickReplies: Record<string, string[]> = {
      tr: ["🚀 Kurulum", "🎯 Turlar", "📅 Rezervasyonlar", "💬 WhatsApp Bot", "🔧 Teknik Destek"],
      en: ["🚀 Setup", "🎯 Tours", "📅 Reservations", "💬 WhatsApp Bot", "🔧 Technical Support"],
      de: ["🚀 Einrichtung", "🎯 Touren", "📅 Reservierungen", "💬 WhatsApp Bot", "🔧 Technische Unterstützung"],
      ru: ["🚀 Настройка", "🎯 Туры", "📅 Бронирования", "💬 WhatsApp Бот", "🔧 Техническая поддержка"],
      ar: ["🚀 الإعداد", "🎯 الجولات", "📅 الحجوزات", "💬 بوت WhatsApp", "🔧 الدعم الفني"],
      fr: ["🚀 Configuration", "🎯 Circuits", "📅 Réservations", "💬 Bot WhatsApp", "🔧 Support technique"],
      es: ["🚀 Configuración", "🎯 Tours", "📅 Reservas", "💬 Bot de WhatsApp", "🔧 Soporte técnico"]
    };
    return quickReplies[i18n.language] || quickReplies.tr;
  };

  const handleQuickReply = (label: string) => {
    const fullMessages: Record<string, Record<string, string>> = {
      tr: {
        "🚀 Kurulum": "Sistemi nasıl kurabilirim? WhatsApp bağlantısı nasıl yapılır?",
        "🎯 Turlar": "Tur nasıl eklerim? Tur tarihlerini nasıl yönetirim?",
        "📅 Rezervasyonlar": "Rezervasyonları nasıl yönetirim? Durum güncellemeleri nasıl yapılır?",
        "💬 WhatsApp Bot": "WhatsApp botu nasıl çalışır? Dil desteği nedir?",
        "🔧 Teknik Destek": "Teknik bir sorunla karşılaştım, yardım alabilir miyim?"
      },
      en: {
        "🚀 Setup": "How can I set up the system? How to connect WhatsApp?",
        "🎯 Tours": "How do I add tours? How to manage tour dates?",
        "📅 Reservations": "How do I manage reservations? How to update statuses?",
        "💬 WhatsApp Bot": "How does the WhatsApp bot work? What is language support?",
        "🔧 Technical Support": "I encountered a technical problem, can I get help?"
      }
    };
    
    const langMessages = fullMessages[i18n.language] || fullMessages.tr;
    const message = langMessages[label] || label;
    
    setShowQuickReplies(false);
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
        content: "Özür dilerim, bir hata oluştu. Lütfen tekrar deneyin veya info@turzz.ai adresinden bizimle iletişime geçin."
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
        content: "Özür dilerim, bir hata oluştu. Lütfen tekrar deneyin veya https://ai.turzz.com/yardim sayfasını ziyaret edin."
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

  const renderContentWithLinks = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|ai\.[^\s]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        let url = part;
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        return (
          <a 
            key={i} 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 underline font-medium"
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="h-14 w-14 md:h-16 md:w-16 rounded-full shadow-lg hover:shadow-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 transition-all duration-300"
        >
          <HelpCircle className="h-6 w-6 md:h-7 md:w-7" />
        </Button>
      ) : (
        <Card className="fixed inset-4 md:relative md:inset-auto md:w-[380px] md:h-[600px] shadow-2xl flex flex-col">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Turzz Destek</h3>
                <p className="text-xs text-white/80">
                  {i18n.language === 'tr' ? 'Size yardımcı olmak için buradayız' : 'We are here to help'}
                </p>
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

          <ScrollArea className="flex-1 p-4">
            {showQuickReplies && messages.length === 1 && (
              <div className="mb-4 p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">
                  {i18n.language === 'tr' ? 'Hızlı Seçenekler:' : 'Quick Options:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {getQuickReplies().map((reply, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs md:text-sm py-2 px-3"
                      onClick={() => handleQuickReply(reply)}
                    >
                      {reply}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                      : "bg-gradient-to-r from-muted to-muted/80 shadow-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {renderContentWithLinks(message.content)}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={i18n.language === 'tr' ? "Nasıl yardımcı olabiliriz?" : "How can we help?"}
                disabled={isLoading}
                className="flex-1 h-12 md:h-10"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="h-12 w-12 md:h-10 md:w-10"
              >
                <Send className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
