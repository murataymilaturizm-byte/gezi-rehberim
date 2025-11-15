-- Create enum for ticket status
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Create enum for ticket priority
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high');

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket_messages table for replies
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for tickets
CREATE POLICY "Agencies can view own tickets"
  ON public.tickets
  FOR SELECT
  USING (
    agency_id = get_user_agency_id(auth.uid()) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Agencies can create own tickets"
  ON public.tickets
  FOR INSERT
  WITH CHECK (agency_id = get_user_agency_id(auth.uid()));

CREATE POLICY "Agencies can update own tickets"
  ON public.tickets
  FOR UPDATE
  USING (agency_id = get_user_agency_id(auth.uid()));

CREATE POLICY "Super admins can manage all tickets"
  ON public.tickets
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS policies for ticket_messages
CREATE POLICY "Users can view messages of their tickets"
  ON public.ticket_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_messages.ticket_id
      AND (
        tickets.agency_id = get_user_agency_id(auth.uid())
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
    )
  );

CREATE POLICY "Users can create messages on their tickets"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_messages.ticket_id
      AND (
        tickets.agency_id = get_user_agency_id(auth.uid())
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
    )
  );

-- Trigger for updating tickets updated_at
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_tickets_agency_id ON public.tickets(agency_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_user_id ON public.ticket_messages(user_id);