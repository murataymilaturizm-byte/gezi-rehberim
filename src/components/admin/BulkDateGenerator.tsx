import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Sparkles, AlertCircle, Loader2 } from "lucide-react";

interface BulkDateGeneratorProps {
  tourId: string;
  agencyId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Pattern = "weekly" | "monthly" | "daily";

const WEEKDAYS = [
  { value: 1, key: "monday" },
  { value: 2, key: "tuesday" },
  { value: 3, key: "wednesday" },
  { value: 4, key: "thursday" },
  { value: 5, key: "friday" },
  { value: 6, key: "saturday" },
  { value: 0, key: "sunday" },
];

export function BulkDateGenerator({ tourId, agencyId, open, onClose, onSuccess }: BulkDateGeneratorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [pattern, setPattern] = useState<Pattern>("weekly");
  const [selectedDays, setSelectedDays] = useState<number[]>([6]);
  const [monthlyDay, setMonthlyDay] = useState(15);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tourDuration, setTourDuration] = useState(1);
  const [priceAdult, setPriceAdult] = useState("");
  const [priceChild, setPriceChild] = useState("");
  const [quota, setQuota] = useState("20");
  const [isLoading, setIsLoading] = useState(false);

  const isMobile = useIsMobile();
  const today = new Date().toISOString().split("T")[0];

  const previewDates = useMemo(() => {
    if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) return [];

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const dates: { departure: Date; returnDate: Date }[] = [];

    if (pattern === "weekly") {
      if (selectedDays.length === 0) return [];
      const cur = new Date(start);
      while (cur <= end) {
        if (selectedDays.includes(cur.getDay())) {
          const dep = new Date(cur);
          const ret = new Date(cur);
          ret.setDate(ret.getDate() + Math.max(0, tourDuration - 1));
          dates.push({ departure: dep, returnDate: ret });
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else if (pattern === "monthly") {
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        const target = new Date(cur.getFullYear(), cur.getMonth(), monthlyDay);
        if (target >= start && target <= end) {
          const dep = new Date(target);
          const ret = new Date(target);
          ret.setDate(ret.getDate() + Math.max(0, tourDuration - 1));
          dates.push({ departure: dep, returnDate: ret });
        }
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      const cur = new Date(start);
      while (cur <= end) {
        const dep = new Date(cur);
        const ret = new Date(cur);
        ret.setDate(ret.getDate() + Math.max(0, tourDuration - 1));
        dates.push({ departure: dep, returnDate: ret });
        cur.setDate(cur.getDate() + 1);
      }
    }

    return dates;
  }, [pattern, selectedDays, monthlyDay, startDate, endDate, tourDuration]);

  const toggleDay = (day: number, checked: boolean) => {
    setSelectedDays((prev) =>
      checked ? [...prev, day] : prev.filter((d) => d !== day)
    );
  };

  const handleGenerate = async () => {
    if (previewDates.length === 0) {
      toast({ title: t("common.error"), description: t("bulkDates.errors.noDates"), variant: "destructive" });
      return;
    }
    if (!priceAdult || isNaN(parseFloat(priceAdult)) || parseFloat(priceAdult) <= 0) {
      toast({ title: t("common.error"), description: t("bulkDates.errors.priceRequired"), variant: "destructive" });
      return;
    }
    if (priceChild && (isNaN(parseFloat(priceChild)) || parseFloat(priceChild) < 0)) {
      toast({ title: t("common.error"), description: t("bulkDates.errors.priceRequired"), variant: "destructive" });
      return;
    }
    if (previewDates.length > 100) {
      toast({ title: t("common.error"), description: t("bulkDates.errors.tooManyDates"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const rows = previewDates.map(({ departure, returnDate }) => ({
        tour_id: tourId,
        agency_id: agencyId,
        departure_date: fmt(departure),
        return_date: fmt(returnDate),
        price_adult: parseFloat(priceAdult),
        price_child: priceChild ? parseFloat(priceChild) : null,
        quota: parseInt(quota) || 20,
      }));

      const { error } = await supabase.from("tour_dates").insert(rows);
      if (error) throw error;

      supabase.functions.invoke("invalidate-tour-cache", { body: { agencyId } }).catch(() => {});

      toast({ title: t("common.success"), description: t("bulkDates.success", { count: rows.length }) });
      onSuccess();
      onClose();
      // reset
      setStartDate(""); setEndDate(""); setPriceAdult(""); setPriceChild(""); setQuota("20");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message || t("bulkDates.errors.generic"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const tooMany = previewDates.length > 100;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${isMobile ? "w-full max-w-none h-[95dvh]" : "max-w-2xl max-h-[90vh]"} overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("bulkDates.title")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t("bulkDates.subtitle")}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pattern */}
          <div className="space-y-1">
            <Label>{t("bulkDates.pattern")}</Label>
            <Select value={pattern} onValueChange={(v: Pattern) => setPattern(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">📅 {t("bulkDates.patterns.weekly")}</SelectItem>
                <SelectItem value="monthly">🗓️ {t("bulkDates.patterns.monthly")}</SelectItem>
                <SelectItem value="daily">⏰ {t("bulkDates.patterns.daily")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Weekly day selection */}
          {pattern === "weekly" && (
            <Card className="p-4">
              <Label className="mb-3 block text-sm font-medium">{t("bulkDates.selectDays")}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEEKDAYS.map((day) => (
                  <label key={day.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedDays.includes(day.value)}
                      onCheckedChange={(c) => toggleDay(day.value, !!c)}
                    />
                    {t(`weekdays.${day.key}`)}
                  </label>
                ))}
              </div>
            </Card>
          )}

          {/* Monthly day */}
          {pattern === "monthly" && (
            <div className="space-y-1">
              <Label>{t("bulkDates.dayOfMonth")}</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(parseInt(e.target.value) || 15)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">{t("bulkDates.monthlyHint")}</p>
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("bulkDates.startDate")}</Label>
              <Input type="date" value={startDate} min={today} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("bulkDates.endDate")}</Label>
              <Input type="date" value={endDate} min={startDate || today} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <Label>{t("bulkDates.tourDuration")}</Label>
            <Input
              type="number"
              min={1}
              max={14}
              value={tourDuration}
              onChange={(e) => setTourDuration(parseInt(e.target.value) || 1)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">{t("bulkDates.durationHint")}</p>
          </div>

          {/* Pricing */}
          <Card className="p-4 space-y-3 bg-muted/20">
            <Label className="font-semibold">💰 {t("bulkDates.pricingAndQuota")}</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("bulkDates.priceAdult")} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={priceAdult}
                  onChange={(e) => setPriceAdult(e.target.value)}
                  placeholder="3500"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("bulkDates.priceChild")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={priceChild}
                  onChange={(e) => setPriceChild(e.target.value)}
                  placeholder="2500"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("bulkDates.quota")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("bulkDates.pricingNote")}</p>
          </Card>

          {/* Preview */}
          {previewDates.length > 0 && (
            <Card className={`p-4 ${tooMany ? "border-destructive bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
              <Label className="font-semibold flex items-center gap-2 mb-2">
                <CalendarDays className="h-4 w-4" />
                {t("bulkDates.preview", { count: previewDates.length })}
              </Label>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {previewDates.slice(0, 25).map((d, i) => (
                  <div key={i} className="flex justify-between text-sm py-0.5 border-b border-border/40 last:border-0">
                    <span>{d.departure.toLocaleDateString("tr-TR")}</span>
                    {tourDuration > 1 && (
                      <span className="text-xs text-muted-foreground">
                        → {d.returnDate.toLocaleDateString("tr-TR")}
                      </span>
                    )}
                  </div>
                ))}
                {previewDates.length > 25 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    + {previewDates.length - 25} {t("bulkDates.moreDates")}
                  </p>
                )}
              </div>
              {tooMany && (
                <div className="flex items-center gap-2 mt-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-xs">{t("bulkDates.errors.tooManyDates")}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || previewDates.length === 0 || tooMany || !priceAdult}
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("bulkDates.generating")}</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />{t("bulkDates.generateButton", { count: previewDates.length })}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
