// Ortak tarih aralığı filtre bileşeni — 3 rapor (Advanced/Customer/Destination) için
// 90 satırlık tekrar eden kart kodu burada tek yerde.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Filter, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export type DateFilterType = '1month' | '3months' | '6months' | '1year' | 'custom';

const localeMap = { tr, en: enUS, de, ru, ar, fr, es };

interface DateRangeFilterProps {
  dateFilter: DateFilterType;
  setDateFilter: (filter: DateFilterType) => void;
  customDateRange: DateRange | undefined;
  setCustomDateRange: (range: DateRange | undefined) => void;
  onExport?: () => void;
}

export function DateRangeFilter({
  dateFilter,
  setDateFilter,
  customDateRange,
  setCustomDateRange,
  onExport,
}: DateRangeFilterProps) {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.language as keyof typeof localeMap] || tr;

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case '1month': return t('analytics.filter.last1Month');
      case '3months': return t('analytics.filter.last3Months');
      case '6months': return t('analytics.filter.last6Months');
      case '1year': return t('analytics.filter.last1Year');
      case 'custom':
        if (customDateRange?.from) {
          const fromDate = format(customDateRange.from, 'dd MMM yyyy', { locale });
          const toDate = customDateRange.to
            ? format(customDateRange.to, 'dd MMM yyyy', { locale })
            : t('analytics.filter.today');
          return `${fromDate} - ${toDate}`;
        }
        return t('analytics.filter.customDate');
      default: return t('analytics.filter.last6Months');
    }
  };

  const presets: Array<{ id: DateFilterType; label: string }> = [
    { id: '1month', label: 'last1Month' },
    { id: '3months', label: 'last3Months' },
    { id: '6months', label: 'last6Months' },
    { id: '1year', label: 'last1Year' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('analytics.advanced.dateFilter')}
          </CardTitle>
          {onExport && (
            <Button onClick={onExport} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              {t('analytics.advanced.export')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {presets.map((opt) => (
            <Button
              key={opt.id}
              variant={dateFilter === opt.id ? 'default' : 'outline'}
              onClick={() => {
                setDateFilter(opt.id);
                setCustomDateRange(undefined);
              }}
              size="sm"
            >
              {t(`analytics.filter.${opt.label}`)}
            </Button>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={dateFilter === 'custom' ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                {dateFilter === 'custom' && customDateRange?.from
                  ? getDateFilterLabel()
                  : <span>{t('analytics.filter.customDate')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={customDateRange}
                onSelect={(range) => {
                  setCustomDateRange(range);
                  if (range?.from) setDateFilter('custom');
                }}
                numberOfMonths={2}
                locale={locale}
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          {t('analytics.filter.showingData')}: <span className="font-medium">{getDateFilterLabel()}</span>
        </p>
      </CardContent>
    </Card>
  );
}
