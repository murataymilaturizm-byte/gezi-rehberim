import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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

interface Tour {
  id: string;
  title: string;
}

interface RegistrationFiltersProps {
  tours: Tour[];
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterTour: string;
  setFilterTour: (value: string) => void;
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
  filterStatus,
  setFilterStatus,
  filterTour,
  setFilterTour,
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

  const statusLabels: Record<string, string> = {
    NEW: t("admin.status.new"),
    PENDING: t("admin.status.pending"),
    CONFIRMED: t("admin.status.confirmed"),
    CANCELLED: t("admin.status.cancelled")
  };

  const hasActiveFilters = 
    filterStatus !== "all" || 
    filterTour !== "all" || 
    filterDateFrom || 
    filterDateTo || 
    filterPriceMin || 
    filterPriceMax;

  return (
    <div className="bg-card rounded-lg border p-3 space-y-3">
      <h3 className="text-sm font-semibold">{t("admin.filters.title")}</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {/* Status Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">
            {t("admin.filters.status")}
          </label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.filters.all")}</SelectItem>
              <SelectItem value="NEW">{statusLabels.NEW}</SelectItem>
              <SelectItem value="PENDING">{statusLabels.PENDING}</SelectItem>
              <SelectItem value="CONFIRMED">{statusLabels.CONFIRMED}</SelectItem>
              <SelectItem value="CANCELLED">{statusLabels.CANCELLED}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tour Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">
            {t("admin.filters.tour")}
          </label>
          <Select value={filterTour} onValueChange={setFilterTour}>
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.filters.allTours")}</SelectItem>
              {tours.map((tour) => (
                <SelectItem key={tour.id} value={tour.id}>
                  {tour.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-1 col-span-2">
          <label className="text-[10px] font-medium text-muted-foreground">
            {t("admin.filters.dateRange")}
          </label>
          <div className="flex gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 flex-1 justify-start text-left font-normal text-[10px] px-1.5",
                    !filterDateFrom && "text-muted-foreground"
                  )}
                >
                  {filterDateFrom ? format(filterDateFrom, "d MMM", { locale: tr }) : t("admin.filters.from")}
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
                    "h-8 flex-1 justify-start text-left font-normal text-[10px] px-1.5",
                    !filterDateTo && "text-muted-foreground"
                  )}
                >
                  {filterDateTo ? format(filterDateTo, "d MMM", { locale: tr }) : t("admin.filters.to")}
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

        {/* Price Range Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">
            {t("admin.filters.priceRange")}
          </label>
          <div className="flex gap-1">
            <input
              type="number"
              value={filterPriceMin}
              onChange={(e) => setFilterPriceMin(e.target.value)}
              placeholder={t("admin.filters.min")}
              className="flex h-8 w-full rounded-md border border-input bg-background px-1.5 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="number"
              value={filterPriceMax}
              onChange={(e) => setFilterPriceMax(e.target.value)}
              placeholder={t("admin.filters.max")}
              className="flex h-8 w-full rounded-md border border-input bg-background px-1.5 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px]"
            onClick={onClearFilters}
          >
            {t("admin.filters.clear")}
          </Button>
        </div>
      )}
    </div>
  );
};
