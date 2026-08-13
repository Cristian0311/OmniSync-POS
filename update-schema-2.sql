-- Fix users table if missing columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sales_goal numeric default 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text not null default 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp with time zone default timezone('utc'::text, now()) not null;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_id text REFERENCES users(id);

-- Fix inventory_levels if missing variant tracking
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS variant_label text;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS min_quantity integer DEFAULT 5;
-- We need to drop existing unique constraints on inventory_levels if they exist and recreate
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_levels_product_branch_variant_key') THEN
    ALTER TABLE inventory_levels ADD CONSTRAINT inventory_levels_product_branch_variant_key UNIQUE (product_id, branch_id, variant_label);
  END IF;
END $$;

-- Fix branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone text;

-- Add new tables
CREATE TABLE IF NOT EXISTS inventory_audits (
  id text primary key,
  date timestamp with time zone not null,
  branch_id text references branches(id),
  user_id text references users(id),
  status text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS inventory_audit_items (
  id text primary key,
  audit_id text references inventory_audits(id) on delete cascade,
  product_id text references products(id),
  product_name text not null,
  variant_label text,
  expected integer not null,
  actual integer not null,
  difference integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS salary_settlements (
  id text primary key,
  user_id text references users(id),
  user_name text not null,
  session_id text references cash_sessions(id),
  base_salary numeric not null,
  commissions numeric not null,
  total numeric not null,
  date timestamp with time zone not null,
  status text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Configs
CREATE TABLE IF NOT EXISTS settings (
  id text primary key,
  store_config jsonb,
  catalog_config jsonb,
  receipt_config jsonb,
  currencies jsonb
);
