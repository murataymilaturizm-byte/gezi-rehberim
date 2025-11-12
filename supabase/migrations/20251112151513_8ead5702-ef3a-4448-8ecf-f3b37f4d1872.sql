-- Admin paneli için INSERT/UPDATE/DELETE politikaları
-- NOT: Production ortamında authentication ile korunmalıdır

-- Tours tablosu için politikalar
CREATE POLICY "Herkes tur ekleyebilir" 
ON tours 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Herkes tur güncelleyebilir" 
ON tours 
FOR UPDATE 
USING (true);

CREATE POLICY "Herkes tur silebilir" 
ON tours 
FOR DELETE 
USING (true);

-- Tour Dates tablosu için politikalar
CREATE POLICY "Herkes tur tarihi ekleyebilir" 
ON tour_dates 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Herkes tur tarihi güncelleyebilir" 
ON tour_dates 
FOR UPDATE 
USING (true);

CREATE POLICY "Herkes tur tarihi silebilir" 
ON tour_dates 
FOR DELETE 
USING (true);