import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Pencil, Trash2, Copy, Sparkles, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useCurrencyConverter } from "@/hooks/useCurrencyConverter";
import { CurrencySelector } from "@/components/CurrencySelector";
import { useState } from "react";
import { TOUR_CATEGORIES } from "@/components/admin/tour-form/TourCategories";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BulkDateGenerator } from "./BulkDateGenerator";
import { EmptyState } from "@/components/EmptyState";
import { MapPin } from "lucide-react";

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
    sold_pax?: number;
  }>;
}

interface ToursListProps {
  tours: Tour[];
  loading: boolean;
  agencyId?: string;
  onExport?: () => void;
  onAddTour?: () => void;
  onAddDate: (tourId: string) => void;
  onEditTour: (tour: Tour) => void;
  onDeleteTour: (tourId: string) => void;
  onEditDate: (tourId: string, date: any) => void;
  onDeleteDate: (dateId: string) => void;
  onRefresh?: () => void;
}

export const ToursList = ({
  tours,
  loading,
  agencyId,
  onExport,
  onAddTour,
  onAddDate,
  onEditTour,
  onDeleteTour,
  onEditDate,
  onDeleteDate,
  onRefresh,
}: ToursListProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [displayCurrency, setDisplayCurrency] = useState<string>('TRY');
  const { convertAndFormat, loading: ratesLoading, refresh } = useCurrencyConverter('USD');

  // Bulk date generator state
  const [bulkDateTourId, setBulkDateTourId] = useState<string | null>(null);

  // Duplicate dialog state
  const [duplicateTour, setDuplicateTour] = useState<Tour | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  const handleOpenDuplicate = (tour: Tour) => {
    setDuplicateTour(tour);
    setDuplicateTitle(`${tour.title} (Kopya)`);
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateTour || !duplicateTitle.trim()) return;
    setDuplicating(true);
    try {
      const { id: _id, created_at: _ca, tour_dates: _td, ...rest } = duplicateTour as any;
      const { data: newTour, error } = await supabase
        .from("tours")
        .insert({ ...rest, title: duplicateTitle.trim() })
        .select()
        .single();
      if (error) throw error;

      // Copy dates if tour has any
      if (duplicateTour.tour_dates && duplicateTour.tour_dates.length > 0 && newTour) {
        const dateCopies = duplicateTour.tour_dates.map(({ id: _did, ...d }: any) => ({
          ...d,
          tour_id: newTour.id,
        }));
        await supabase.from("tour_dates").insert(dateCopies);
      }

      if (agencyId) {
        supabase.functions.invoke("invalidate-tour-cache", { body: { agencyId } }).catch(() => {});
      }

      toast({ title: t("common.success"), description: t("tours.duplicateSuccess") });
      setDuplicateTour(null);
      onRefresh?.();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message || t("tours.duplicateError"), variant: "destructive" });
    } finally {
      setDuplicating(false);
    }
  };

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
      <EmptyState
        icon={MapPin}
        title={t("tours.emptyTitle")}
        description={t("tours.emptyDescription")}
        action={onAddTour ? { label: t("tours.addFirstTour"), onClick: onAddTour } : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {displayCurrency !== 'TRY' && (
            <span className="text-xs">
              💱 {t('admin.excel.currencyConversionNote', { currency: displayCurrency })}
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
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>{tour.destination}</span>
                  <span>•</span>
                  <Badge variant="secondary" className="text-xs">
                    {tourTypeLabels[tour.type] || tour.type}
                  </Badge>
                  {tour.tur_kategorisi && (() => {
                    const cat = TOUR_CATEGORIES.find(c => c.value === tour.tur_kategorisi);
                    return cat ? (
                      <Badge variant="outline" className="text-xs">
                        {cat.icon} {cat.label}
                      </Badge>
                    ) : null;
                  })()}
                  {tour.hotel_name && (
                    <Badge variant="outline" className="text-xs">
                      🏨 {tour.hotel_name} {tour.hotel_stars ? `${"⭐".repeat(tour.hotel_stars)}` : ""}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => onAddDate(tour.id)}>
                  <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{t("admin.tours.addDate")}</span>
                </Button>
                {agencyId && (
                  <Button variant="outline" size="sm" onClick={() => setBulkDateTourId(tour.id)}>
                    <Sparkles className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">{t("tours.bulkDate")}</span>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditTour(tour)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      {t("common.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenDuplicate(tour)}>
                      <Copy className="w-4 h-4 mr-2" />
                      {t("tours.duplicate")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDeleteTour(tour.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                              {t('admin.excel.originalPrice')}: {date.price_adult} {tour.currency}
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {t("admin.tours.quota")}: {date.quota}
                          {(date.sold_pax !== undefined && date.sold_pax > 0) ? (
                            <span className="ml-1">
                              (<span className="text-green-600 font-medium">{date.sold_pax} {t("admin.tours.sold")}</span>
                              {" / "}
                              <span className={`font-medium ${(date.quota - date.sold_pax) <= 3 ? 'text-orange-500' : 'text-foreground'}`}>
                                {date.quota - date.sold_pax} {t("admin.tours.remaining")}
                              </span>)
                            </span>
                          ) : (
                            <span className="ml-1 text-muted-foreground">
                              ({date.quota} {t("admin.tours.remaining")})
                            </span>
                          )}
                        </span>
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

      {/* Bulk date generator */}
      {agencyId && bulkDateTourId && (
        <BulkDateGenerator
          tourId={bulkDateTourId}
          agencyId={agencyId}
          open={!!bulkDateTourId}
          onClose={() => setBulkDateTourId(null)}
          onSuccess={() => { setBulkDateTourId(null); onRefresh?.(); }}
        />
      )}

      {/* Duplicate dialog */}
      <Dialog open={!!duplicateTour} onOpenChange={(o) => !o && setDuplicateTour(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              {t("tours.duplicate")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <Label>{t("tours.duplicateTitleLabel")}</Label>
            <Input
              value={duplicateTitle}
              onChange={(e) => setDuplicateTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmDuplicate()}
              autoFocus
            />
            {duplicateTour?.tour_dates && duplicateTour.tour_dates.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("tours.copyDatesNote", { count: duplicateTour.tour_dates.length })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateTour(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleConfirmDuplicate} disabled={duplicating || !duplicateTitle.trim()}>
              {duplicating ? t("common.saving") : t("tours.duplicateConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
