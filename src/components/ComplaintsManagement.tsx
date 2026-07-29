import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadsList } from "@/components/admin/registrations/LeadsList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Complaint {
  id: string;
  phone: string;
  message: string;
  type: string;
  status: string;
  created_at: string;
}

// 2026-07-10 İş3: tip-rozeti TR etiket haritası (eski: ham EN i18n key basıyordu).
const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  complaint: "Şikâyet",
  cancellation_request: "İptal Talebi",
  low_rating: "Düşük Puan ⭐",
  contact_request: "İletişim Talebi",
};

export function ComplaintsManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  // P7-A: Hizmet Talepleri sekmesi (agency_leads) aynı ekranda
  const [agencyIdP7, setAgencyIdP7] = useState<string | null>(null);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (!agency) return;
      setAgencyIdP7(agency.id);

      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('agency_id', agency.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      toast({
        title: t("common.error"),
        description: t("complaints.loadError"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("complaints.updateSuccess")
      });
      
      fetchComplaints();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: t("common.error"),
        description: t("complaints.updateError"),
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* P7-A (2026-07-29): TEK ADRES — iki "talep" kavramı aynı ekranda iki sekmede.
          Şikayetler = J-14/complaints (mevcut) · Hizmet Talepleri = agency_leads
          (tur-dışı uçak/otel/transfer/vize). Kayıtlar'daki 4. görünüm KALDIRILDI:
          canlı kanıt — acente lead'i "Talepler-Şikayetler"de aradı, Kayıtlar'da
          olduğu için bulamadı. */}
      <Tabs defaultValue="complaints" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="complaints">{t("complaints.tabComplaints", { defaultValue: "Şikayetler" })}</TabsTrigger>
          <TabsTrigger value="leads">{t("complaints.tabLeads", { defaultValue: "Hizmet Talepleri" })}</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t("admin.leads.viewTitle", { defaultValue: "Talepler" })}
              </CardTitle>
              <CardDescription>{t("admin.leads.description", { defaultValue: "Bot'un yakaladığı tur dışı hizmet talepleri (uçak, otel, transfer, vize)." })}</CardDescription>
            </CardHeader>
            <CardContent>
              <LeadsList agencyId={agencyIdP7} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complaints" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t("complaints.title")}
          </CardTitle>
          <CardDescription>
            {t("complaints.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {complaints.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t("complaints.noComplaints")}
            </div>
          ) : (
            <div className="space-y-4">
              {complaints.map((complaint) => (
                <Card key={complaint.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={complaint.type === 'complaint' || complaint.type === 'low_rating' ? 'destructive' : 'default'}>
                            {COMPLAINT_TYPE_LABELS[complaint.type] || t(`complaints.types.${complaint.type}`, { defaultValue: "Talep" })}
                          </Badge>
                          <Badge variant={
                            complaint.status === 'new' ? 'secondary' :
                            complaint.status === 'reviewed' ? 'default' : 'outline'
                          }>
                            {t(`complaints.statuses.${complaint.status}`)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {complaint.phone} • {format(new Date(complaint.created_at), "dd MMM yyyy HH:mm", { locale: tr })}
                        </div>
                      </div>
                      {complaint.status !== 'resolved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(
                            complaint.id, 
                            complaint.status === 'new' ? 'reviewed' : 'resolved'
                          )}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {complaint.status === 'new' ? t("complaints.markReviewed") : t("complaints.markResolved")}
                        </Button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{complaint.message}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}