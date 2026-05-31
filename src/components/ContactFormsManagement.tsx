import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Mail, MessageSquare, Calendar } from "lucide-react";

interface ContactForm {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  replied: "bg-green-100 text-green-700",
  closed: "bg-muted text-muted-foreground"
};

interface ContactFormsManagementProps {
  isSuperAdmin?: boolean;
}

export const ContactFormsManagement = ({ isSuperAdmin = false }: ContactFormsManagementProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const statusLabels: Record<string, string> = {
    new: t("superAdmin.contactForms.statusNew"),
    in_progress: t("superAdmin.contactForms.statusInProgress"),
    replied: t("superAdmin.contactForms.statusReplied"),
    closed: t("superAdmin.contactForms.statusClosed")
  };
  const [forms, setForms] = useState<ContactForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<ContactForm | null>(null);
  const [editingNotes, setEditingNotes] = useState("");

  useEffect(() => {
    if (isSuperAdmin) loadForms();
  }, [isSuperAdmin]);

  const loadForms = async () => {
    try {
      const { data, error } = await supabase
        .from("contact_forms")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setForms(data || []);
    } catch (error) {
      console.error("Error loading contact forms:", error);
      toast({
        title: t("common.error"),
        description: t("superAdmin.contactForms.loadError"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (formId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("contact_forms")
        .update({ status: newStatus })
        .eq("id", formId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("superAdmin.contactForms.updateSuccess")
      });

      loadForms();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: t("common.error"),
        description: t("superAdmin.contactForms.updateError"),
        variant: "destructive"
      });
    }
  };

  const handleUpdateNotes = async () => {
    if (!selectedForm) return;

    try {
      const { error } = await supabase
        .from("contact_forms")
        .update({ notes: editingNotes })
        .eq("id", selectedForm.id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("superAdmin.contactForms.updateSuccess")
      });

      setSelectedForm(null);
      setEditingNotes("");
      loadForms();
    } catch (error) {
      console.error("Error updating notes:", error);
      toast({
        title: t("common.error"),
        description: t("superAdmin.contactForms.updateError"),
        variant: "destructive"
      });
    }
  };

  const stats = {
    total: forms.length,
    new: forms.filter(f => f.status === 'new').length,
    inProgress: forms.filter(f => f.status === 'in_progress').length,
    replied: forms.filter(f => f.status === 'replied').length
  };

  if (!isSuperAdmin) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          {t("common.loading")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-sm text-muted-foreground">{t("superAdmin.contactForms.title")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
            <p className="text-sm text-muted-foreground">{t("superAdmin.contactForms.statusNew")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
            <p className="text-sm text-muted-foreground">{t("superAdmin.contactForms.statusInProgress")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.replied}</div>
            <p className="text-sm text-muted-foreground">{t("superAdmin.contactForms.statusReplied")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Forms Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t("superAdmin.contactForms.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("superAdmin.contactForms.noForms")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>İsim</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Mesaj</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Notlar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(form.created_at), "dd MMM yyyy HH:mm", { locale: tr })}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{form.name}</TableCell>
                      <TableCell>
                        <a 
                          href={`mailto:${form.email}`}
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Mail className="w-4 h-4" />
                          {form.email}
                        </a>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="line-clamp-2 text-sm text-muted-foreground">
                          {form.message}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={form.status}
                          onValueChange={(value) => handleStatusChange(form.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue>
                              <Badge className={statusColors[form.status]}>
                                {statusLabels[form.status]}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Yeni</SelectItem>
                            <SelectItem value="in_progress">İnceleniyor</SelectItem>
                            <SelectItem value="replied">Yanıtlandı</SelectItem>
                            <SelectItem value="closed">Kapatıldı</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedForm(form);
                            setEditingNotes(form.notes || "");
                          }}
                        >
                          {form.notes ? "Düzenle" : "Ekle"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Modal */}
      {selectedForm && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Notlar - {selectedForm.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Mesaj:</p>
              <p className="text-sm text-muted-foreground">{selectedForm.message}</p>
            </div>
            <Textarea
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder={t("superAdmin.contactForms.notesPlaceholder")}
              rows={4}
            />
            <div className="flex gap-2">
              <Button onClick={handleUpdateNotes} className="bg-gradient-ocean">
                Kaydet
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedForm(null);
                  setEditingNotes("");
                }}
              >
                İptal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
