import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAvailableCurrencies } from "@/utils/currency";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  showRefresh?: boolean;
}

export function CurrencySelector({ 
  value, 
  onChange, 
  onRefresh,
  loading = false,
  showRefresh = true 
}: CurrencySelectorProps) {
  const currencies = getAvailableCurrencies();

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Para Birimi" />
        </SelectTrigger>
        <SelectContent>
          {currencies.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              {currency.symbol} {currency.code} - {currency.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {showRefresh && onRefresh && (
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={loading}
          title="Kurları Yenile"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}
