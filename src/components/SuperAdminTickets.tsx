import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, CheckCircle, XCircle, Building } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  created_at: string;
  updated_at: string;
  agency_id: string;
  agencies?: { name: string };
}

interface TicketMessage {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  user_id: string;
}

interface SuperAdminTicketsProps {
  isSuperAdmin?: boolean;
}

export const SuperAdminTickets = ({ isSuperAdmin = false }: SuperAdminTicketsProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, agencies(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error loading tickets:", error);
      toast({
        title: t("admin.toast.error"),
        description: t("tickets.loadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast({ title: t("admin.toast.error"), variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: "open" | "in_progress" | "resolved" | "closed") => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: newStatus })
        .eq("id", ticketId);

      if (error) throw error;

      toast({
        title: t("admin.toast.success"),
        description: t("tickets.statusUpdated"),
      });

      loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: t("admin.toast.error"),
        description: t("tickets.updateError"),
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not found");

      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: selectedTicket.id,
        user_id: userData.user.id,
        message: newMessage,
        is_admin: true,
      });

      if (error) throw error;

      // Update ticket's updated_at
      await supabase
        .from("tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);

      setNewMessage("");
      loadMessages(selectedTicket.id);
      loadTickets();

      toast({
        title: t("admin.toast.success"),
        description: t("tickets.messageSent"),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: t("admin.toast.error"),
        description: t("tickets.messageError"),
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      open: "default",
      in_progress: "secondary",
      resolved: "secondary",
      closed: "destructive",
    };
    
    const icons = {
      open: <Clock className="w-3 h-3 mr-1" />,
      in_progress: <MessageSquare className="w-3 h-3 mr-1" />,
      resolved: <CheckCircle className="w-3 h-3 mr-1" />,
      closed: <XCircle className="w-3 h-3 mr-1" />,
    };

    return (
      <Badge variant={variants[status] || "default"} className="flex items-center gap-1 w-fit">
        {icons[status as keyof typeof icons]}
        {t(`tickets.status.${status}`)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };

    return (
      <Badge className={colors[priority] || colors.medium}>
        {t(`tickets.priority.${priority}`)}
      </Badge>
    );
  };

  const filteredTickets = filterStatus === "all" 
    ? tickets 
    : tickets.filter(t => t.status === filterStatus);

  if (!isSuperAdmin) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("tickets.adminTitle")}</h2>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.filters.all")}</SelectItem>
            <SelectItem value="open">{t("tickets.status.open")}</SelectItem>
            <SelectItem value="in_progress">{t("tickets.status.in_progress")}</SelectItem>
            <SelectItem value="resolved">{t("tickets.status.resolved")}</SelectItem>
            <SelectItem value="closed">{t("tickets.status.closed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground">{t("tickets.noTickets")}</p>
            <p className="text-sm text-muted-foreground/70">{t("tickets.noTicketsAdminHint", "Henüz herhangi bir destek talebi bulunmuyor.")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{ticket.agencies?.name ?? t("common.unknown", "Bilinmiyor")}</span>
                    </div>
                    <CardTitle className="text-lg">{ticket.title}</CardTitle>
                    <div className="flex gap-2">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={ticket.status}
                      onValueChange={(value) => handleUpdateStatus(ticket.id, value as "open" | "in_progress" | "resolved" | "closed")}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">{t("tickets.status.open")}</SelectItem>
                        <SelectItem value="in_progress">{t("tickets.status.in_progress")}</SelectItem>
                        <SelectItem value="resolved">{t("tickets.status.resolved")}</SelectItem>
                        <SelectItem value="closed">{t("tickets.status.closed")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Dialog open={viewDialogOpen && selectedTicket?.id === ticket.id} onOpenChange={(open) => {
                      setViewDialogOpen(open);
                      if (!open) setSelectedTicket(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          {t("tickets.viewDetails")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Building className="w-5 h-5" />
                            {ticket.agencies?.name ?? t("common.unknown", "Bilinmiyor")} - {ticket.title}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm">{ticket.description}</p>
                          </div>
                          
                          <div className="space-y-4">
                            <h4 className="font-semibold">{t("tickets.messages")}</h4>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {messages.map((msg) => (
                                <div
                                  key={msg.id}
                                  className={`p-3 rounded-lg ${
                                    msg.is_admin
                                      ? "bg-primary/10 ml-8"
                                      : "bg-muted mr-8"
                                  }`}
                                >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium">
                                      {msg.is_admin ? t("tickets.admin") : t("tickets.user")}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(msg.created_at), "d MMM HH:mm", { locale: tr })}
                                    </span>
                                  </div>
                                  <p className="text-sm">{msg.message}</p>
                                </div>
                              ))}
                            </div>
                            
                            {ticket.status !== "closed" && (
                              <div className="flex gap-2">
                                <Textarea
                                  value={newMessage}
                                  onChange={(e) => setNewMessage(e.target.value)}
                                  placeholder={t("tickets.writeReply")}
                                  rows={3}
                                />
                                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                                  {t("tickets.send")}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {ticket.description}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("tickets.created")}: {format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: tr })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
