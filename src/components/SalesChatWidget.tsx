import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { ChatWidgetBase } from "./chat/ChatWidgetBase";
import { ShoppingCart } from "lucide-react";

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
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: getInitialMessage()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  const renderSalesMessage = (message: Message, index: number) => (
    <div
      key={index}
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          message.role === "user"
            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md"
            : "bg-gradient-to-r from-secondary to-secondary/80 shadow-md"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap font-medium">{message.content}</p>
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
    es: "Asesor de ventas"
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
      placeholder={i18n.language === 'tr' ? "Mesajınızı yazın..." : "Type your message..."}
      buttonLabel={salesButtonLabels[i18n.language] || salesButtonLabels.tr}
      buttonColor="bg-gradient-to-r from-orange-500 to-orange-600"
    />
  );
};
