import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUR_CATEGORIES } from "@/components/admin/tour-form/TourCategories";

export interface TourFilterState {
  searchQuery: string;
  filterDestination: string;
  filterCategory: string;
  filterType: string;
  filterCurrency: string;
  filterPriceMin: string;
  filterPriceMax: string;
}

export const EMPTY_TOUR_FILTERS: TourFilterState = {
  searchQuery: "",
  filterDestination: "ALL",
  filterCategory: "ALL",
  filterType: "ALL",
  filterCurrency: "ALL",
  filterPriceMin: "",
  filterPriceMax: "",
};

interface TourFiltersProps extends TourFilterState {
  availableDestinations: string[];
  availableCurrencies: string[];
  onSearchChange: (v: string) => void;
  onFilterDestinationChange: (v: string) => void;
  onFilterCategoryChange: (v: string) => void;
  onFilterTypeChange: (v: string) => void;
  onFilterCurrencyChange: (v: string) => void;
  onFilterPriceMinChange: (v: string) => void;
  onFilterPriceMaxChange: (v: string) => void;
  onClearFilters: () => void;
}

export const TourFilters = ({
  searchQuery,
  filterDestination,
  filterCategory,
  filterType,
  filterCurrency,
  filterPriceMin,
  filterPriceMax,
  availableDestinations,
  availableCurrencies,
  onSearchChange,
  onFilterDestinationChange,
  onFilterCategoryChange,
  onFilterTypeChange,
  onFilterCurrencyChange,
  onFilterPriceMinChange,
  onFilterPriceMaxChange,
  onClearFilters,
}: TourFiltersProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const activeFilterCount = [
    filterDestination !== "ALL",
    filterCategory !== "ALL",
    filterType !== "ALL",
    filterCurrency !== "ALL",
    !!filterPriceMin,
    !!filterPriceMax,
  ].filter(Boolean).length;

  const tourTypeLabels: Record<string, string> = {
    DAYTRIP: t("admin.tourTypes.daytrip"),
    N2: t("admin.tourTypes.n2"),
    N3: t("admin.tourTypes.n3"),
  };

  return (
    <div className="bg-card rounded-lg border">
      {/* Compact bar: search + quick filters */}
      <div className="p-3 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("tours.filters.searchPlaceholder")}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Filter className="w-3.5 h-3.5" />
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {(searchQuery || activeFilterCount > 0) && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onClearFilters}>
              <X className="w-3 h-3" /> {t("filters.clear")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {t("filters.detailed")}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Expandable detailed filters */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-3">
          {/* Row 1: Destination, Category, Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("tours.filters.destination")}</label>
              <Select value={filterDestination} onValueChange={onFilterDestinationChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("tours.filters.allDestinations")}</SelectItem>
                  {availableDestinations.map((dest) => (
                    <SelectItem key={dest} value={dest}>{dest}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("filters.category")}</label>
              <Select value={filterCategory} onValueChange={onFilterCategoryChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("filters.allCategories")}</SelectItem>
                  {TOUR_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("tours.filters.type")}</label>
              <Select value={filterType} onValueChange={onFilterTypeChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("filters.all")}</SelectItem>
                  {Object.entries(tourTypeLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Currency, Price Range */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("tours.filters.currency")}</label>
              <Select value={filterCurrency} onValueChange={onFilterCurrencyChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("filters.all")}</SelectItem>
                  {availableCurrencies.map((cur) => (
                    <SelectItem key={cur} value={cur}>{cur}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 col-span-1 sm:col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground">{t("admin.filters.priceRange")}</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={filterPriceMin}
                  onChange={(e) => onFilterPriceMinChange(e.target.value)}
                  placeholder={t("tours.filters.minPrice")}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <input
                  type="number"
                  value={filterPriceMax}
                  onChange={(e) => onFilterPriceMaxChange(e.target.value)}
                  placeholder={t("tours.filters.maxPrice")}
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
