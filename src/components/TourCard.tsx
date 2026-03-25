import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { formatPrice } from "@/utils/currency";

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
      sold_pax?: number;
    }>;
    currency: string;
    program_url?: string;
  };
  onRegister: (tourId: string, dateId: string) => void;
}

export const TourCard = ({ tour, onRegister }: TourCardProps) => {
  const { t } = useTranslation();
  const firstDate = tour.dates[0];
  
  const tourTypeLabels: Record<string, string> = {
    DAYTRIP: t("admin.tourTypes.daytrip"),
    N2: t("admin.tourTypes.n2"),
    N3: t("admin.tourTypes.n3")
  };
  
  if (!firstDate) return null;

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
            {formatPrice(firstDate.price_adult, tour.currency)}
          </span>
          <span className="text-sm text-muted-foreground">{t("admin.tours.perPerson")}</span>
        </div>

        {/* Kota */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-secondary" />
          <span className="text-muted-foreground">
            {(() => {
              const remaining = firstDate.quota - (firstDate.sold_pax || 0);
              if (remaining <= 0) {
                return <span className="text-destructive">{t("admin.tours.quotaFull")}</span>;
              }
              return (
                <span className="text-foreground font-medium">
                  {remaining} {t("admin.tours.quota")}
                  {firstDate.sold_pax && firstDate.sold_pax > 0 && (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({firstDate.sold_pax} {t("admin.tours.sold")})
                    </span>
                  )}
                </span>
              );
            })()}
          </span>
        </div>

        {/* Diğer Tarihler */}
        {tour.dates.length > 1 && (
          <div className="pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">{t("admin.tours.otherDates")}</p>
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
            {t("admin.tours.program")}
          </Button>
        )}
        <Button
          size="sm"
          className="flex-1 bg-gradient-sunset hover:opacity-90 transition-smooth"
          onClick={() => onRegister(tour.id, firstDate.id)}
          disabled={(firstDate.quota - (firstDate.sold_pax || 0)) <= 0}
        >
          {t("admin.tours.preRegistration")}
        </Button>
      </CardFooter>
    </Card>
  );
};
