import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Agency {
  id: string;
  agency_name: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  active: boolean;
  created_at: string;
  profiles: {
    full_name: string | null;
  };
}

export const AgencyManagement = () => {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    agency_name: "",
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: "",
  });

  useEffect(() => {
    loadAgencies();
  }, []);

  const loadAgencies = async () => {
    setLoading(true);
    try {
      const { data: agenciesData, error } = await supabase
        .from("agencies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get profiles separately
      const agenciesWithProfiles = await Promise.all(
        (agenciesData || []).map(async (agency) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", agency.user_id)
            .single();

          return {
            ...agency,
            profiles: profile || { full_name: null },
          };
        })
      );

      setAgencies(agenciesWithProfiles);
    } catch (error) {
      console.error("Error loading agencies:", error);
      toast({
        title: "Hata",
        description: "Acenteler yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingAgency) {
        // Update existing agency
        const { error } = await supabase
          .from("agencies")
          .update({
            agency_name: formData.agency_name,
            twilio_account_sid: formData.twilio_account_sid,
            twilio_auth_token: formData.twilio_auth_token,
            twilio_phone_number: formData.twilio_phone_number,
          })
          .eq("id", editingAgency.id);

        if (error) throw error;

        toast({
          title: "Başarılı! ✅",
          description: "Acente güncellendi",
        });
      } else {
        // Create new user and agency
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
            },
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Kullanıcı oluşturulamadı");

        // Create agency
        const { error: agencyError } = await supabase
          .from("agencies")
          .insert({
            user_id: authData.user.id,
            agency_name: formData.agency_name,
            twilio_account_sid: formData.twilio_account_sid,
            twilio_auth_token: formData.twilio_auth_token,
            twilio_phone_number: formData.twilio_phone_number,
          });

        if (agencyError) throw agencyError;

        // Assign agency role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "agency",
          });

        if (roleError) throw roleError;

        toast({
          title: "Başarılı! ✅",
          description: "Acente oluşturuldu",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadAgencies();
    } catch (error: any) {
      console.error("Error saving agency:", error);
      toast({
        title: "Hata",
        description: error.message || "İşlem başarısız",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (agencyId: string) => {
    if (!confirm("Bu acenteyi silmek istediğinize emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("agencies")
        .delete()
        .eq("id", agencyId);

      if (error) throw error;

      toast({
        title: "Başarılı! ✅",
        description: "Acente silindi",
      });
      loadAgencies();
    } catch (error: any) {
      console.error("Error deleting agency:", error);
      toast({
        title: "Hata",
        description: error.message || "Silme işlemi başarısız",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (agency: Agency) => {
    setEditingAgency(agency);
    setFormData({
      email: "",
      password: "",
      full_name: "",
      agency_name: agency.agency_name,
      twilio_account_sid: agency.twilio_account_sid,
      twilio_auth_token: agency.twilio_auth_token,
      twilio_phone_number: agency.twilio_phone_number,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingAgency(null);
    setFormData({
      email: "",
      password: "",
      full_name: "",
      agency_name: "",
      twilio_account_sid: "",
      twilio_auth_token: "",
      twilio_phone_number: "",
    });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Acente Yönetimi
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-ocean hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                Yeni Acente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingAgency ? "Acente Düzenle" : "Yeni Acente Ekle"}
                </DialogTitle>
                <DialogDescription>
                  {editingAgency 
                    ? "Acente bilgilerini güncelleyin" 
                    : "Yeni acente hesabı oluşturun"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingAgency && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Ad Soyad</Label>
                        <Input
                          id="full_name"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Şifre</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="agency_name">Acente Adı</Label>
                  <Input
                    id="agency_name"
                    value={formData.agency_name}
                    onChange={(e) => setFormData({ ...formData, agency_name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="twilio_account_sid">Twilio Account SID</Label>
                    <Input
                      id="twilio_account_sid"
                      value={formData.twilio_account_sid}
                      onChange={(e) => setFormData({ ...formData, twilio_account_sid: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twilio_auth_token">Twilio Auth Token</Label>
                    <Input
                      id="twilio_auth_token"
                      type="password"
                      value={formData.twilio_auth_token}
                      onChange={(e) => setFormData({ ...formData, twilio_auth_token: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twilio_phone_number">Twilio Telefon Numarası</Label>
                  <Input
                    id="twilio_phone_number"
                    value={formData.twilio_phone_number}
                    onChange={(e) => setFormData({ ...formData, twilio_phone_number: e.target.value })}
                    placeholder="+14155238886"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    İptal
                  </Button>
                  <Button type="submit" className="bg-gradient-ocean hover:opacity-90">
                    {editingAgency ? "Güncelle" : "Oluştur"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
        ) : agencies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Henüz acente eklenmemiş
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acente Adı</TableHead>
                <TableHead>Yetkili</TableHead>
                <TableHead>Twilio Telefon</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((agency) => (
                <TableRow key={agency.id}>
                  <TableCell className="font-medium">{agency.agency_name}</TableCell>
                  <TableCell>{agency.profiles?.full_name || "-"}</TableCell>
                  <TableCell>{agency.twilio_phone_number}</TableCell>
                  <TableCell>
                    <Badge variant={agency.active ? "default" : "secondary"}>
                      {agency.active ? "Aktif" : "Pasif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(agency)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(agency.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
