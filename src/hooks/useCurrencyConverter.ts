import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrency } from '@/utils/currency';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

const CACHE_KEY = 'exchange_rates_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function useCurrencyConverter(baseCurrency: string = 'USD') {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load rates from cache or API
  useEffect(() => {
    loadExchangeRates();
  }, [baseCurrency]);

  const loadExchangeRates = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cachedData = JSON.parse(cached) as ExchangeRates;
        const age = Date.now() - cachedData.timestamp;
        
        // Use cached data if less than 24 hours old
        if (age < CACHE_DURATION && cachedData.base === baseCurrency) {
          setRates(cachedData);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh rates
      const { data, error: functionError } = await supabase.functions.invoke('get-exchange-rates', {
        body: { base: baseCurrency }
      });

      if (functionError) throw functionError;
      if (!data.success) throw new Error(data.error);

      const ratesData: ExchangeRates = {
        base: data.base,
        rates: data.rates,
        timestamp: Date.now()
      };

      setRates(ratesData);
      
      // Cache the rates
      localStorage.setItem(CACHE_KEY, JSON.stringify(ratesData));
    } catch (err) {
      console.error('Error loading exchange rates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load exchange rates');
    } finally {
      setLoading(false);
    }
  };

  // Convert amount from one currency to another
  const convert = (amount: number, fromCurrency: string, toCurrency: string): number => {
    if (!rates) return amount;
    if (fromCurrency === toCurrency) return amount;

    // Convert to base currency first
    const inBase = fromCurrency === rates.base 
      ? amount 
      : amount / (rates.rates[fromCurrency] || 1);

    // Convert to target currency
    const result = toCurrency === rates.base 
      ? inBase 
      : inBase * (rates.rates[toCurrency] || 1);

    return result;
  };

  // Format converted amount with proper currency
  const convertAndFormat = (
    amount: number, 
    fromCurrency: string, 
    toCurrency: string
  ): string => {
    const converted = convert(amount, fromCurrency, toCurrency);
    const currency = getCurrency(toCurrency);
    
    const formatted = new Intl.NumberFormat(currency.locale, {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals
    }).format(converted);

    return `${formatted} ${currency.code}`;
  };

  // Get exchange rate between two currencies
  const getRate = (fromCurrency: string, toCurrency: string): number | null => {
    if (!rates) return null;
    if (fromCurrency === toCurrency) return 1;

    const fromRate = rates.rates[fromCurrency] || 1;
    const toRate = rates.rates[toCurrency] || 1;

    return toRate / fromRate;
  };

  // Refresh rates manually
  const refresh = () => {
    localStorage.removeItem(CACHE_KEY);
    loadExchangeRates();
  };

  return {
    rates,
    loading,
    error,
    convert,
    convertAndFormat,
    getRate,
    refresh
  };
}
