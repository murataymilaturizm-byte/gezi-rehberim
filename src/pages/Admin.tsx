import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plane } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Tour {
  id: string;
  title: string;
  destination: string;
  type: string;
  created_at: string;
}

interface Registration {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  created_at: string;
  tours: {
    title: string;
  };
  tour_dates: {
    departure_date: string;
  };
}

const statusLabels: Record<string, string> = {
  NEW: "Yeni",
  PENDING: "Beklemede",
  CONFIRMED: "Onaylandı",
  CANCELLED: "İptal"
};

const tourTypeLabels: Record<string, string> = {
  DAYTRIP: "Günübirlik",
  N2: "2 Gece",
  N3: "3 Gece"
};

const Admin = () => {
  const [activeTab, setActiveTab] = useState<"tours" | "registrations">("tours");
  const [tours, setTours] = useState<Tour[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "tours") {
        const { data, error } = await supabase
          .from("tours")
          .select("*")
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        setTours(data || []);
      } else {
        const { data, error } = await supabase
          .from("registrations")
          .select(`
            *,
            tours (title),
            tour_dates (departure_date)
          `)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        setRegistrations(data || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <a href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Ana Sayfa
                </a>
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-ocean flex items-center justify-center">
                  <Plane className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "tours" ? "default" : "outline"}
            onClick={() => setActiveTab("tours")}
            className={activeTab === "tours" ? "bg-gradient-ocean" : ""}
          >
            Turlar
          </Button>
          <Button
            variant={activeTab === "registrations" ? "default" : "outline"}
            onClick={() => setActiveTab("registrations")}
            className={activeTab === "registrations" ? "bg-gradient-ocean" : ""}
          >
            Kayıtlar
          </Button>
        </div>

        {/* Content */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>
              {activeTab === "tours" ? "Tur Listesi" : "Kayıt Listesi"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
            ) : activeTab === "tours" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tur Adı</TableHead>
                    <TableHead>Destinasyon</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Oluşturulma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tours.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Henüz tur eklenmemiş
                      </TableCell>
                    </TableRow>
                  ) : (
                    tours.map((tour) => (
                      <TableRow key={tour.id}>
                        <TableCell className="font-medium">{tour.title}</TableCell>
                        <TableCell>{tour.destination}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {tourTypeLabels[tour.type] || tour.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(tour.created_at), "d MMM yyyy", { locale: tr })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Tur</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Kişi</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Henüz kayıt yok
                      </TableCell>
                    </TableRow>
                  ) : (
                    registrations.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">{reg.full_name}</TableCell>
                        <TableCell>{reg.phone}</TableCell>
                        <TableCell>{reg.tours?.title}</TableCell>
                        <TableCell>
                          {reg.tour_dates?.departure_date &&
                            format(new Date(reg.tour_dates.departure_date), "d MMM yyyy", { locale: tr })}
                        </TableCell>
                        <TableCell>{reg.pax}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              reg.status === "CONFIRMED"
                                ? "default"
                                : reg.status === "CANCELLED"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {statusLabels[reg.status] || reg.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
