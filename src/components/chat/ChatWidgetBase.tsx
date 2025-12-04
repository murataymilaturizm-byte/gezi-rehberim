import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWidgetBaseProps {
  title: string;
  messages: Message[];
  input: string;
  isLoading: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  renderMessage?: (message: Message, index: number) => React.ReactNode;
  placeholder?: string;
  buttonLabel?: string;
  buttonColor?: string;
}

export const ChatWidgetBase = ({
  title,
  messages,
  input,
  isLoading,
  isOpen,
  onOpenChange,
  onInputChange,
  onSend,
  renderMessage,
  placeholder = "Mesajınızı yazın...",
  buttonLabel,
  buttonColor = "bg-gradient-to-r from-primary to-primary/80"
}: ChatWidgetBaseProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const defaultRenderMessage = (message: Message, index: number) => (
    <div
      key={index}
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50">
      {!isOpen ? (
        <Button
          onClick={() => onOpenChange(true)}
          size="lg"
          className={`rounded-full shadow-lg ${buttonColor} hover:scale-105 transition-transform h-14 w-14 md:h-auto md:w-auto`}
        >
          <MessageCircle className="h-6 w-6" />
          {buttonLabel && <span className="ml-2 hidden md:inline">{buttonLabel}</span>}
        </Button>
      ) : (
        <Card className="fixed inset-4 md:relative md:inset-auto md:w-[380px] md:h-[600px] flex flex-col shadow-2xl">
          <div className={`${buttonColor} text-white p-4 rounded-t-lg flex justify-between items-center`}>
            <h3 className="font-semibold text-lg">{title}</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.map((message, index) => 
              renderMessage ? renderMessage(message, index) : defaultRenderMessage(message, index)
            )}
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
                onChange={(e) => onInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                disabled={isLoading}
                className="flex-1 h-12 md:h-10"
              />
              <Button
                onClick={onSend}
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
