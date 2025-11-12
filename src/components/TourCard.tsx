import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface TourCardProps {
  tour: {
    id: string;
    title: string;
    destination: string;
    type: string;
    dates: Array<{
      id: string;
      departure_date: string;
      return_date?: string;
      price_adult: number;
      quota: number;
    }>;
    currency: string;
    program_url?: string;
  };
  onRegister: (tourId: string, dateId: string) => void;
}

const tourTypeLabels: Record<string, string> = {
  DAYTRIP: "Günübirlik",
  N2: "2 Gece 3 Gün",
  N3: "3 Gece 4 Gün"
};

export const TourCard = ({ tour, onRegister }: TourCardProps) => {
  const firstDate = tour.dates[0];
  
  if (!firstDate) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <Card className="shadow-card hover:shadow-soft transition-smooth border-border/50 overflow-hidden group">
      <div className="h-2 bg-gradient-ocean" />
      
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg text-card-foreground group-hover:text-primary transition-smooth">
            {tour.title}
          </h3>
          <Badge variant="secondary" className="shrink-0">
            {tourTypeLabels[tour.type] || tour.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* İlk Tarih */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 text-primary" />
          <span>
            {format(new Date(firstDate.departure_date), "d MMMM yyyy", { locale: tr })}
            {firstDate.return_date && firstDate.return_date !== firstDate.departure_date && (
              <> - {format(new Date(firstDate.return_date), "d MMMM yyyy", { locale: tr })}</>
            )}
          </span>
        </div>

        {/* Fiyat */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-primary">
            {formatPrice(firstDate.price_adult)} {tour.currency}
          </span>
          <span className="text-sm text-muted-foreground">kişi başı</span>
        </div>

        {/* Kota */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-secondary" />
          <span className="text-muted-foreground">
            {firstDate.quota > 0 ? (
              <span className="text-foreground font-medium">{firstDate.quota} kişilik kontenjan</span>
            ) : (
              <span className="text-destructive">Kontenjan doldu</span>
            )}
          </span>
        </div>

        {/* Diğer Tarihler */}
        {tour.dates.length > 1 && (
          <div className="pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Diğer Tarihler:</p>
            <div className="flex flex-wrap gap-2">
              {tour.dates.slice(1).map((date) => (
                <Badge key={date.id} variant="outline" className="text-xs">
                  {format(new Date(date.departure_date), "d MMM", { locale: tr })}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-4 border-t border-border/50">
        {tour.program_url && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open(tour.program_url, '_blank')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Program
          </Button>
        )}
        <Button
          size="sm"
          className="flex-1 bg-gradient-sunset hover:opacity-90 transition-smooth"
          onClick={() => onRegister(tour.id, firstDate.id)}
          disabled={firstDate.quota === 0}
        >
          Ön Kayıt
        </Button>
      </CardFooter>
    </Card>
  );
};
