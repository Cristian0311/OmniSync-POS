-- Fix products table columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS margin numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_type text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_value numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_alert integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_serial boolean;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_kit boolean;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_days integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS device_color text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_sizes jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_colors jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS next_serial integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image text;

-- Also cost in schema vs cost_price in useStore
-- Wait, useStore sends cost_price, but maybe cost is required?
ALTER TABLE products ALTER COLUMN cost DROP NOT NULL;
ALTER TABLE products ALTER COLUMN stock DROP NOT NULL;
ALTER TABLE products ALTER COLUMN min_stock DROP NOT NULL;
