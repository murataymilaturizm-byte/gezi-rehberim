import { useState } from "react";
import { ChatWidget } from "@/components/ChatWidget";
import { TourCard } from "@/components/TourCard";
import { RegistrationModal } from "@/components/RegistrationModal";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plane } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Tour {
  id: string;
  title: string;
  destination: string;
  type: string;
  currency: string;
  program_url?: string;
  dates: Array<{
    id: string;
    departure_date: string;
    return_date?: string;
    price_adult: number;
    quota: number;
  }>;
}

const Index = () => {
  const { toast } = useToast();
  const [tours, setTours] = useState<Tour[]>([]);
  const [registrationModal, setRegistrationModal] = useState<{
    isOpen: boolean;
    tourId: string;
    tourDateId: string;
    tourTitle: string;
  }>({
    isOpen: false,
    tourId: "",
    tourDateId: "",
    tourTitle: ""
  });

  const handleSearch = async (query: string, filters: any) => {
    try {
      // Turları çek
      let toursQuery = supabase
        .from("tours")
        .select(`
          id,
          title,
          destination,
          type,
          currency,
          program_url,
          tour_dates (
            id,
            departure_date,
            return_date,
            price_adult,
            quota
          )
        `);

      // Tip filtresi
      if (filters.type) {
        const typeMap: Record<string, "DAYTRIP" | "N2" | "N3"> = {
          "daytrip": "DAYTRIP",
          "2night": "N2",
          "3night": "N3"
        };
        const dbType = typeMap[filters.type as keyof typeof typeMap];
        if (dbType) {
          toursQuery = toursQuery.eq("type", dbType);
        }
      }

      const { data: toursData, error } = await toursQuery;

      if (error) throw error;

      // Verileri dönüştür
      const formattedTours: Tour[] = (toursData || []).map((tour: any) => ({
        id: tour.id,
        title: tour.title,
        destination: tour.destination,
        type: tour.type,
        currency: tour.currency,
        program_url: tour.program_url,
        dates: (tour.tour_dates || [])
          .filter((date: any) => {
            // Tarih filtresi
            if (filters.date_hint) {
              return date.departure_date === filters.date_hint;
            }
            return true;
          })
          .sort((a: any, b: any) => 
            new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime()
          )
      })).filter(tour => tour.dates.length > 0);

      setTours(formattedTours);

      if (formattedTours.length === 0) {
        toast({
          title: "Sonuç Bulunamadı",
          description: "Arama kriterlerinize uygun tur bulunamadı. Lütfen farklı kriterlerle deneyin.",
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Hata",
        description: "Arama sırasında bir hata oluştu.",
        variant: "destructive"
      });
    }
  };

  const handleRegister = (tourId: string, dateId: string) => {
    const tour = tours.find(t => t.id === tourId);
    if (tour) {
      setRegistrationModal({
        isOpen: true,
        tourId,
        tourDateId: dateId,
        tourTitle: tour.title
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-ocean flex items-center justify-center">
                <Plane className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Tur Satış Asistanı</h1>
                <p className="text-xs text-muted-foreground">Size en uygun turu bulalım</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin">Admin Panel</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[450px,1fr] gap-6 h-[calc(100vh-140px)]">
          {/* Chat Widget */}
          <div className="h-full">
            <ChatWidget onSearch={handleSearch} />
          </div>

          {/* Tour Results */}
          <div className="overflow-y-auto space-y-4 pr-2">
            {tours.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-gradient-ocean/10 flex items-center justify-center mx-auto">
                    <Plane className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Tur Araması Yapın</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Sol taraftaki sohbet kutusunu kullanarak istediğiniz tura ulaşabilirsiniz.
                    Örneğin: "Günübirlik Kapadokya 20 Temmuz"
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    {tours.length} Tur Bulundu
                  </h2>
                </div>
                {tours.map((tour) => (
                  <TourCard
                    key={tour.id}
                    tour={tour}
                    onRegister={handleRegister}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </main>

      <RegistrationModal
        isOpen={registrationModal.isOpen}
        onClose={() => setRegistrationModal({ ...registrationModal, isOpen: false })}
        tourId={registrationModal.tourId}
        tourDateId={registrationModal.tourDateId}
        tourTitle={registrationModal.tourTitle}
      />
    </div>
  );
};

export default Index;
