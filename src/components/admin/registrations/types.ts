// Faz 1: 3 görünümlü Kayıtlar yapısı için ortak tip.
// useRegistrations'taki Registration tipiyle BİREBİR uyumlu — değiştirmeyin.

export interface RegistrationRow {
  id: string;
  full_name: string;
  phone: string;
  pax: number;
  status: string;
  note?: string;
  created_at: string;
  tour_id: string;
  tour_date_id?: string;
  source_channel?: string;
  payment_status?: string;
  total_amount?: number;
  paid_amount?: number;
  deposit_amount?: number;
  tours: {
    id?: string;
    title: string;
    destination: string;
    currency?: string;
  };
  tour_dates: {
    id?: string;
    departure_date: string;
    return_date?: string | null;
    price_adult: number;
    price_child?: number | null;
    quota?: number | null;
  };
}

export type RegistrationsView = "list" | "by-tour" | "by-departure";

export type StatusValue = "NEW" | "PENDING" | "CONFIRMED" | "CANCELLED";
