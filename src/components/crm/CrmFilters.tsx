// CrmFilters — arama + segment filtresi + sıralama çubuğu.
// Tüm state üst component'te tutulur (controlled); CrmFilters sadece sunum.
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { AutoTagKey } from "./customerTags";

export type SegmentFilter = "all" | AutoTagKey;
export type SortKey = "lastActivity" | "spending" | "bookings" | "name";

const SEGMENT_OPTIONS: SegmentFilter[] = ["all", "vip", "customer", "lead", "prospect", "active", "inactive"];
const SORT_OPTIONS: SortKey[] = ["lastActivity", "spending", "bookings", "name"];

interface CrmFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  segment: SegmentFilter;
  setSegment: (v: SegmentFilter) => void;
  sort: SortKey;
  setSort: (v: SortKey) => void;
  counts: Record<SegmentFilter, number>;
}

export const CrmFilters = ({
  search,
  setSearch,
  segment,
  setSegment,
  sort,
  setSort,
  counts,
}: CrmFiltersProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {/* Arama + sıralama (üst satır) */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.whatsapp.userProfiles.searchPlaceholder", {
              defaultValue: "İsim veya telefonla ara…",
            })}
            className="ps-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((k) => (
              <SelectItem key={k} value={k}>
                {t(`admin.whatsapp.userProfiles.sort.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Segment chip filtre satırı — yatay scroll mobilde */}
      <div className="flex flex-wrap gap-1.5 -mx-0.5">
        {SEGMENT_OPTIONS.map((seg) => {
          const isActive = segment === seg;
          const count = counts[seg] ?? 0;
          return (
            <button
              key={seg}
              type="button"
              onClick={() => setSegment(seg)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <span>{t(`admin.whatsapp.userProfiles.filter.${seg}`)}</span>
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-4 px-1 rounded-full text-[10px] tabular-nums ${
                  isActive ? "bg-primary-foreground/20" : "bg-muted text-foreground/70"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
