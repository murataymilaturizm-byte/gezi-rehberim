import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, MessageSquare, Clock, CheckCircle, XCircle } from "lucide-react";
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

export const TicketManagement = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

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
    }
  };

  const handleCreateTicket = async () => {
    if (!title.trim() || !description.trim()) {
      toast({
        title: t("admin.toast.error"),
        description: t("tickets.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not found");

      const { data: agencyData } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", userData.user.id)
        .single();

      if (!agencyData) throw new Error("Agency not found");

      const { error } = await supabase.from("tickets").insert({
        agency_id: agencyData.id,
        title,
        description,
        priority,
      });

      if (error) throw error;

      toast({
        title: t("admin.toast.success"),
        description: t("tickets.createSuccess"),
      });

      setTitle("");
      setDescription("");
      setPriority("medium");
      setCreateDialogOpen(false);
      loadTickets();
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast({
        title: t("admin.toast.error"),
        description: t("tickets.createError"),
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
        is_admin: false,
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

  if (loading) {
    return <div className="text-center py-8">{t("admin.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("tickets.title")}</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-ocean">
              <Plus className="w-4 h-4 mr-2" />
              {t("tickets.createNew")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("tickets.createNew")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t("tickets.titleLabel")}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("tickets.titlePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">{t("tickets.priorityLabel")}</Label>
                <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("tickets.priority.low")}</SelectItem>
                    <SelectItem value="medium">{t("tickets.priority.medium")}</SelectItem>
                    <SelectItem value="high">{t("tickets.priority.high")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("tickets.descriptionLabel")}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("tickets.descriptionPlaceholder")}
                  rows={6}
                />
              </div>
              <Button onClick={handleCreateTicket} className="w-full">
                {t("tickets.submit")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">{t("tickets.noTickets")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <CardTitle className="text-lg">{ticket.title}</CardTitle>
                    <div className="flex gap-2">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
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
                        <DialogTitle>{ticket.title}</DialogTitle>
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
                                    {msg.is_admin ? t("tickets.admin") : t("tickets.you")}
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
                                placeholder={t("tickets.writeMessage")}
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
