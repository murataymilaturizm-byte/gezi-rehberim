import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TOUR_CATEGORIES } from "@/components/admin/tour-form/TourCategories";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";

interface Tour {
  id: string;
  title: string;
}

interface RegistrationFiltersProps {
  tours: Tour[];
  availableTourDates: string[];
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterTour: string;
  setFilterTour: (value: string) => void;
  filterTourDate: string;
  setFilterTourDate: (value: string) => void;
  filterSourceChannel: string;
  setFilterSourceChannel: (value: string) => void;
  filterCategory: string;
  setFilterCategory: (value: string) => void;
  filterDateFrom: Date | undefined;
  setFilterDateFrom: (date: Date | undefined) => void;
  filterDateTo: Date | undefined;
  setFilterDateTo: (date: Date | undefined) => void;
  filterPriceMin: string;
  setFilterPriceMin: (value: string) => void;
  filterPriceMax: string;
  setFilterPriceMax: (value: string) => void;
  onClearFilters: () => void;
}

export const RegistrationFilters = ({
  tours,
  availableTourDates,
  filterStatus,
  setFilterStatus,
  filterTour,
  setFilterTour,
  filterTourDate,
  setFilterTourDate,
  filterSourceChannel,
  setFilterSourceChannel,
  filterCategory,
  setFilterCategory,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  filterPriceMin,
  setFilterPriceMin,
  filterPriceMax,
  setFilterPriceMax,
  onClearFilters
}: RegistrationFiltersProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const statusLabels: Record<string, string> = {
    NEW: t("admin.status.new"),
    PENDING: t("admin.status.pending"),
    CONFIRMED: t("admin.status.confirmed"),
    CANCELLED: t("admin.status.cancelled")
  };

  const activeFilterCount = [
    filterStatus !== "ALL",
    filterTour !== "ALL",
    filterTourDate !== "ALL",
    filterSourceChannel !== "ALL",
    filterCategory !== "ALL",
    !!filterDateFrom,
    !!filterDateTo,
    !!filterPriceMin,
    !!filterPriceMax,
  ].filter(Boolean).length;

  return (
    <div className="bg-card rounded-lg border">
      {/* Compact bar with quick filters */}
      <div className="p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mr-1">
          <Filter className="w-4 h-4" />
          Filtre
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>
          )}
        </div>

        {/* Quick status chips */}
        <div className="flex gap-1 flex-wrap">
          {["ALL", "NEW", "PENDING", "CONFIRMED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full border transition-colors",
                filterStatus === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              {s === "ALL" ? "Tümü" : statusLabels[s]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onClearFilters}>
              <X className="w-3 h-3" /> Temizle
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            Detaylı
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Expandable detailed filters */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-3">
          {/* Row 1: Category, Tour, Tour Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Kategori</label>
              <Select
                value={filterCategory}
                onValueChange={(value) => {
                  setFilterCategory(value);
                  setFilterTour("ALL");
                  setFilterTourDate("ALL");
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tüm Kategoriler</SelectItem>
                  {TOUR_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("admin.filters.tour")}</label>
              <Select
                value={filterTour}
                onValueChange={(value) => {
                  setFilterTour(value);
                  setFilterTourDate("ALL");
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("admin.filters.allTours")}</SelectItem>
                  {tours.map((tour) => (
                    <SelectItem key={tour.id} value={tour.id}>{tour.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("admin.filters.tourDate")}</label>
              <Select
                value={filterTourDate}
                onValueChange={setFilterTourDate}
                disabled={availableTourDates.length === 0}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={availableTourDates.length === 0 ? "Tarih yok" : undefined} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("admin.filters.allDates")}</SelectItem>
                  {availableTourDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {format(new Date(date), "d MMMM yyyy", { locale: tr })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Source, Date Range, Price Range */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("admin.filters.sourceChannel")}</label>
              <Select value={filterSourceChannel} onValueChange={setFilterSourceChannel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("admin.filters.all")}</SelectItem>
                  <SelectItem value="WHATSAPP">💬 WhatsApp</SelectItem>
                  <SelectItem value="PHONE">📞 Telefon</SelectItem>
                  <SelectItem value="OFFICE">🏢 Ofis</SelectItem>
                  <SelectItem value="INSTAGRAM">📸 Instagram</SelectItem>
                  <SelectItem value="OTHER">📋 Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("admin.filters.dateRange")}</label>
              <div className="flex gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-8 flex-1 justify-start text-left font-normal text-[11px] px-2",
                        !filterDateFrom && "text-muted-foreground"
                      )}
                    >
                      {filterDateFrom ? format(filterDateFrom, "d MMM", { locale: tr }) : "Başlangıç"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filterDateFrom}
                      onSelect={setFilterDateFrom}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-8 flex-1 justify-start text-left font-normal text-[11px] px-2",
                        !filterDateTo && "text-muted-foreground"
                      )}
                    >
                      {filterDateTo ? format(filterDateTo, "d MMM", { locale: tr }) : "Bitiş"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filterDateTo}
                      onSelect={setFilterDateTo}
                      disabled={(date) => filterDateFrom ? date < filterDateFrom : false}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground">{t("admin.filters.priceRange")}</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={filterPriceMin}
                  onChange={(e) => setFilterPriceMin(e.target.value)}
                  placeholder="Min ₺"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <input
                  type="number"
                  value={filterPriceMax}
                  onChange={(e) => setFilterPriceMax(e.target.value)}
                  placeholder="Max ₺"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
