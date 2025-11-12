import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWidgetProps {
  onSearch: (query: string, filters: any) => void;
}

const quickChips = ["Günübirlik", "2 Gece", "Temmuz", "Kapadokya"];

export const ChatWidget = ({ onSearch }: ChatWidgetProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Merhaba 👋 Hangi tur ve tarih aralığına bakayım? Örn: 'Günübirlik Kapadokya 20 Temmuz'"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Basit kuralsal ayrıştırma
      const parsed = parseMessage(messageText);
      
      if (parsed.intent === "tour.search") {
        // Arama yap
        await onSearch(messageText, {
          type: parsed.entities.type,
          date_hint: parsed.entities.date_iso,
          pax: parsed.entities.pax
        });
        
        const assistantMessage: Message = {
          role: "assistant",
          content: `${parsed.entities.destination || "Tüm destinasyonlar"} için uygun turları aşağıda bulabilirsiniz. 🎯`
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const assistantMessage: Message = {
          role: "assistant",
          content: "Size nasıl yardımcı olabilirim? Tur araması için destinasyon ve tarih belirtebilirsiniz."
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseMessage = (text: string): any => {
    const lowerText = text.toLowerCase();
    const result: any = {
      intent: "tour.search",
      entities: {
        destination: null,
        type: null,
        date_text: null,
        date_iso: null,
        pax: null
      }
    };

    // Destinasyon tespiti
    if (lowerText.includes("kapadokya")) result.entities.destination = "Kapadokya";
    if (lowerText.includes("ayvalık")) result.entities.destination = "Ayvalık";

    // Tur tipi
    if (lowerText.includes("günübirlik") || lowerText.includes("günü birlik")) {
      result.entities.type = "daytrip";
    } else if (lowerText.includes("2 gece") || lowerText.includes("iki gece")) {
      result.entities.type = "2night";
    } else if (lowerText.includes("3 gece") || lowerText.includes("üç gece")) {
      result.entities.type = "3night";
    }

    // Basit tarih ayrıştırma
    const months: Record<string, string> = {
      "ocak": "01", "şubat": "02", "mart": "03", "nisan": "04",
      "mayıs": "05", "haziran": "06", "temmuz": "07", "ağustos": "08",
      "eylül": "09", "ekim": "10", "kasım": "11", "aralık": "12"
    };

    for (const [monthName, monthNum] of Object.entries(months)) {
      if (lowerText.includes(monthName)) {
        const dayMatch = lowerText.match(/(\d{1,2})\s+/);
        if (dayMatch) {
          const day = dayMatch[1].padStart(2, '0');
          result.entities.date_iso = `2026-${monthNum}-${day}`;
          result.entities.date_text = `${day} ${monthName}`;
        }
      }
    }

    // Kişi sayısı
    const paxMatch = lowerText.match(/(\d+)\s*(kişi|kişilik)/);
    if (paxMatch) {
      result.entities.pax = parseInt(paxMatch[1]);
    }

    return result;
  };

  return (
    <Card className="flex flex-col h-full shadow-card border-border/50">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-gradient-ocean">
        <div className="flex items-center gap-2 text-primary-foreground">
          <Sparkles className="w-5 h-5" />
          <h2 className="font-semibold">Tur Asistanı</h2>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2 transition-smooth",
                message.role === "user"
                  ? "bg-gradient-ocean text-primary-foreground"
                  : "bg-accent text-accent-foreground"
              )}
            >
              <p className="text-sm">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-accent text-accent-foreground rounded-2xl px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0s" }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0.2s" }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Chips */}
      <div className="px-4 pb-2 flex gap-2 flex-wrap">
        {quickChips.map((chip) => (
          <Button
            key={chip}
            variant="outline"
            size="sm"
            onClick={() => handleSend(chip)}
            className="rounded-full text-xs hover:bg-accent"
          >
            {chip}
          </Button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Mesajınızı yazın..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="bg-gradient-ocean hover:opacity-90 transition-smooth"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
