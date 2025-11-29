import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { ChatWidgetBase } from "./chat/ChatWidgetBase";

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
      es: "¡Hola! ¿Cómo puedo ayudarte con Turzz AI? ¿Te gustaría información sobre precios, características o una demostración?",
    };
    return welcomeMessages[i18n.language] || welcomeMessages.tr;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: getInitialMessage(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Dil değiştiğinde karşılama mesajını güncelle (konuşmayı resetliyoruz)
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: getInitialMessage(),
      },
    ]);
  }, [i18n.language]);

  // İçerikteki linkleri tıklanabilir yap
  const renderContentWithLinks = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|ai\.[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, i) => {
      const isUrl = /^(https?:\/\/[^\s]+|www\.[^\s]+|ai\.[^\s]+)$/i.test(part);
      if (isUrl) {
        let url = part;
        if (!url.startsWith("http")) {
          url = "https://" + url;
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    // Önce UI'da göster
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("sales-chat", {
        body: {
          message: input,
          // ÖNEMLİ: Son user mesajını da history’ye ekleyip backend’e gönderiyoruz
          conversationHistory: [...messages, userMessage],
          language: i18n.language,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);

      const errorMessages: Record<string, string> = {
        tr: "Özür dilerim, bir hata oluştu. Lütfen tekrar deneyin veya info@turzz.ai adresinden bizimle iletişime geçin.",
        en: "Sorry, something went wrong. Please try again or contact us at info@turzz.ai.",
        de: "Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie uns unter info@turzz.ai.",
        ru: "Извините, произошла ошибка. Пожалуйста, попробуйте еще раз или свяжитесь с нами по адресу info@turzz.ai.",
        ar: "عذراً، حدث خطأ ما. يرجى المحاولة مرة أخرى أو التواصل معنا عبر info@turzz.ai.",
        fr: "Désolé, une erreur s'est produite. Veuillez réessayer ou nous contacter à info@turzz.ai.",
        es: "Lo siento, ocurrió un error. Inténtalo de nuevo o contáctanos en info@turzz.ai.",
      };

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessages[i18n.language] || errorMessages.tr,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSalesMessage = (message: Message, index: number) => (
    <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          message.role === "user"
            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md"
            : "bg-gradient-to-r from-secondary to-secondary/80 shadow-md"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap font-medium">{renderContentWithLinks(message.content)}</p>
      </div>
    </div>
  );

  const salesButtonLabels: Record<string, string> = {
    tr: "Satış Danışmanı",
    en: "Sales Consultant",
    de: "Verkaufsberater",
    ru: "Консультант по продажам",
    ar: "مستشار المبيعات",
    fr: "Conseiller commercial",
    es: "Asesor de ventas",
  };

  return (
    <ChatWidgetBase
      title={salesButtonLabels[i18n.language] || salesButtonLabels.tr}
      messages={messages}
      input={input}
      isLoading={isLoading}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onInputChange={setInput}
      onSend={handleSend}
      renderMessage={renderSalesMessage}
      placeholder={i18n.language === "tr" ? "Mesajınızı yazın..." : "Type your message..."}
      buttonLabel={salesButtonLabels[i18n.language] || salesButtonLabels.tr}
      buttonColor="bg-gradient-to-r from-orange-500 to-orange-600"
    />
  );
};
