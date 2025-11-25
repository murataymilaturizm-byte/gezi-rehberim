import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function ComplaintsManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);

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
        title: "Hata",
        description: "Şikayetler yüklenemedi",
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
        title: "Başarılı",
        description: "Durum güncellendi"
      });
      
      fetchComplaints();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Hata",
        description: "Durum güncellenemedi",
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Şikayet ve Geri Bildirimler
          </CardTitle>
          <CardDescription>
            Chatbot üzerinden gelen şikayet ve geri bildirimleri yönetin
          </CardDescription>
        </CardHeader>
        <CardContent>
          {complaints.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Henüz şikayet veya geri bildirim bulunmuyor
            </div>
          ) : (
            <div className="space-y-4">
              {complaints.map((complaint) => (
                <Card key={complaint.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={complaint.type === 'complaint' ? 'destructive' : 'default'}>
                            {complaint.type === 'complaint' ? 'Şikayet' : 'Geri Bildirim'}
                          </Badge>
                          <Badge variant={
                            complaint.status === 'new' ? 'secondary' :
                            complaint.status === 'reviewed' ? 'default' : 'outline'
                          }>
                            {complaint.status === 'new' ? 'Yeni' :
                             complaint.status === 'reviewed' ? 'İncelendi' : 'Çözüldü'}
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
                          {complaint.status === 'new' ? 'İncele' : 'Çöz'}
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
    </div>
  );
}