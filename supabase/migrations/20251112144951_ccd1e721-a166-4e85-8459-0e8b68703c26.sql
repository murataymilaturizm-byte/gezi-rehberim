-- Tur tipleri için enum
CREATE TYPE tour_type AS ENUM ('DAYTRIP', 'N2', 'N3');

-- Kayıt durumları için enum
CREATE TYPE registration_status AS ENUM ('NEW', 'PENDING', 'CONFIRMED', 'CANCELLED');

-- Turlar tablosu
CREATE TABLE tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  type tour_type NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  min_pax INTEGER DEFAULT 1,
  visa_required BOOLEAN DEFAULT false,
  program_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tur tarihleri tablosu
CREATE TABLE tour_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  departure_date DATE NOT NULL,
  return_date DATE,
  price_adult DECIMAL(10, 2) NOT NULL,
  price_child DECIMAL(10, 2),
  price_single DECIMAL(10, 2),
  quota INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Kayıtlar tablosu
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  tour_date_id UUID NOT NULL REFERENCES tour_dates(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pax INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  status registration_status NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS politikaları - herkes okuyabilir, kimse yazamaz (admin paneli için ayrı çözüm gerekecek)
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Herkes turları ve tarihleri görebilir
CREATE POLICY "Turlar herkese açık" ON tours FOR SELECT USING (true);
CREATE POLICY "Tur tarihleri herkese açık" ON tour_dates FOR SELECT USING (true);

-- Kayıtları herkes ekleyebilir
CREATE POLICY "Herkes kayıt oluşturabilir" ON registrations FOR INSERT WITH CHECK (true);

-- Kayıtları herkes görebilir (admin için)
CREATE POLICY "Kayıtlar herkese açık" ON registrations FOR SELECT USING (true);

-- Seed veriler - Kapadokya turları
INSERT INTO tours (title, destination, type, currency, min_pax, visa_required, program_url)
VALUES 
  ('Kapadokya Günübirlik Tur', 'Kapadokya', 'DAYTRIP', 'TRY', 10, false, 'https://example.com/program/kapadokya.pdf'),
  ('Kapadokya 2 Gece 3 Gün', 'Kapadokya', 'N2', 'TRY', 15, false, 'https://example.com/program/kapadokya-2gece.pdf');

-- Günübirlik tur tarihleri
INSERT INTO tour_dates (tour_id, departure_date, return_date, price_adult, quota)
SELECT id, '2026-07-20', '2026-07-20', 5200, 30
FROM tours WHERE title = 'Kapadokya Günübirlik Tur';

INSERT INTO tour_dates (tour_id, departure_date, return_date, price_adult, quota)
SELECT id, '2026-07-22', '2026-07-22', 5200, 30
FROM tours WHERE title = 'Kapadokya Günübirlik Tur';

-- 2 gecelik tur tarihi
INSERT INTO tour_dates (tour_id, departure_date, return_date, price_adult, price_child, price_single, quota)
SELECT id, '2026-05-01', '2026-05-03', 2900, 1900, 3900, 20
FROM tours WHERE title = 'Kapadokya 2 Gece 3 Gün';