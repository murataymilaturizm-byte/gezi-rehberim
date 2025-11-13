-- Add location fields to agencies table
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS region text,
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_agencies_city ON agencies(city);
CREATE INDEX IF NOT EXISTS idx_agencies_region ON agencies(region);

-- Add comment for documentation
COMMENT ON COLUMN agencies.city IS 'City where the agency is located';
COMMENT ON COLUMN agencies.region IS 'Region/Province where the agency is located';
COMMENT ON COLUMN agencies.latitude IS 'Latitude coordinate for map visualization';
COMMENT ON COLUMN agencies.longitude IS 'Longitude coordinate for map visualization';