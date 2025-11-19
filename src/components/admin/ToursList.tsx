import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Tour {
  id: string;
  title: string;
  destination: string;
  type: string;
  currency: string;
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
                        <span className="font-medium">{date.price_adult} {tour.currency}</span>
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
