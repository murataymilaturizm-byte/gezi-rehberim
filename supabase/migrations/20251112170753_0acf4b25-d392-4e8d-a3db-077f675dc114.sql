-- WhatsApp konuşma geçmişi tablosu
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for faster queries
CREATE INDEX idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone);
CREATE INDEX idx_whatsapp_conversations_created_at ON public.whatsapp_conversations(created_at);

-- RLS policies
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (admin paneli için)
CREATE POLICY "Konuşmalar herkese açık" 
ON public.whatsapp_conversations 
FOR SELECT 
USING (true);

-- Herkes ekleyebilir (webhook için)
CREATE POLICY "Herkes konuşma ekleyebilir" 
ON public.whatsapp_conversations 
FOR INSERT 
WITH CHECK (true);