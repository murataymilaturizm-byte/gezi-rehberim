import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useCurrencyConverter } from "@/hooks/useCurrencyConverter";
import { CurrencySelector } from "@/components/CurrencySelector";
import { useState } from "react";

interface Tour {
  id: string;
  title: string;
  destination: string;
  type: string;
  currency: string;
  min_pax: number;
  visa_required: boolean;
  program_url?: string;
  program_kisa?: string;
  hareket_noktasi?: string;
  toplanma_saati?: string;
  tur_sure?: string;
  konaklama?: string;
  ulasim?: string;
  tur_kategorisi?: string;
  gezilecek_yerler?: string;
  visa_notes?: string;
  hotel_name?: string;
  hotel_stars?: number;
  created_at: string;
  tour_dates?: Array<{
    id: string;
    departure_date: string;
    return_date?: string;
    price_adult: number;
    quota: number;
  }>;
}

interface ToursListProps {
  tours: Tour[];
  loading: boolean;
  onExport?: () => void;
  onAddTour?: () => void;
  onAddDate: (tourId: string) => void;
  onEditTour: (tour: Tour) => void;
  onDeleteTour: (tourId: string) => void;
  onEditDate: (tourId: string, date: any) => void;
  onDeleteDate: (dateId: string) => void;
}

export const ToursList = ({
  tours,
  loading,
  onExport,
  onAddTour,
  onAddDate,
  onEditTour,
  onDeleteTour,
  onEditDate,
  onDeleteDate
}: ToursListProps) => {
  const { t } = useTranslation();
  const [displayCurrency, setDisplayCurrency] = useState<string>('TRY');
  const { convertAndFormat, loading: ratesLoading, refresh } = useCurrencyConverter('USD');

  const tourTypeLabels: Record<string, string> = {
    DAYTRIP: t("admin.tourTypes.daytrip"),
    N2: t("admin.tourTypes.n2"),
    N3: t("admin.tourTypes.n3")
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("admin.loading")}
      </div>
    );
  }

  if (tours.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("admin.tours.noTours")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {displayCurrency !== 'TRY' && (
            <span className="text-xs">
              💱 Fiyatlar anlık kurla {displayCurrency} cinsinden gösteriliyor
            </span>
          )}
        </div>
        <CurrencySelector
          value={displayCurrency}
          onChange={setDisplayCurrency}
          onRefresh={refresh}
          loading={ratesLoading}
        />
      </div>
      
      {tours.map((tour) => (
        <Card key={tour.id} className="border-border/50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{tour.title}</h3>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <span>{tour.destination}</span>
                  <span>•</span>
                  <Badge variant="secondary" className="text-xs">
                    {tourTypeLabels[tour.type] || tour.type}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddDate(tour.id)}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {t("admin.tours.addDate")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditTour(tour)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteTour(tour.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          {tour.tour_dates && tour.tour_dates.length > 0 && (
            <CardContent>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t("admin.tours.dates")}:</h4>
                <div className="space-y-2">
                  {tour.tour_dates.map((date) => (
                    <div
                      key={date.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-accent/50 text-sm"
                    >
                      <div className="flex gap-4">
                        <span>
                          {format(new Date(date.departure_date), "d MMM yyyy", { locale: tr })}
                          {date.return_date && date.return_date !== date.departure_date && (
                            <> - {format(new Date(date.return_date), "d MMM yyyy", { locale: tr })}</>
                          )}
                        </span>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {convertAndFormat(date.price_adult, tour.currency, displayCurrency)}
                          </span>
                          {displayCurrency !== tour.currency && (
                            <span className="text-xs text-muted-foreground">
                              Orijinal: {date.price_adult} {tour.currency}
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground">{t("admin.tours.quota")}: {date.quota}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditDate(tour.id, date)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteDate(date.id)}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};
