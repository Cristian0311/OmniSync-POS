ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES users(id);

CREATE TABLE IF NOT EXISTS inventory_audits (
  id text primary key,
  date timestamp with time zone not null,
  branch_id uuid references branches(id),
  user_id uuid references users(id),
  status text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS inventory_audit_items (
  id uuid default uuid_generate_v4() primary key,
  audit_id text references inventory_audits(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  variant_label text,
  expected integer not null,
  actual integer not null,
  difference integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS salary_settlements (
  id text primary key,
  user_id uuid references users(id),
  user_name text not null,
  session_id uuid references cash_sessions(id),
  base_salary numeric not null,
  commissions numeric not null,
  total numeric not null,
  date timestamp with time zone not null,
  status text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE inventory_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for inventory_audits" ON inventory_audits FOR ALL USING (true);
CREATE POLICY "Allow all for inventory_audit_items" ON inventory_audit_items FOR ALL USING (true);
CREATE POLICY "Allow all for salary_settlements" ON salary_settlements FOR ALL USING (true);

-- Añadir tabla de configuración
create table if not exists settings (
  id text primary key,
  store_config jsonb,
  catalog_config jsonb,
  receipt_config jsonb,
  currencies jsonb
);

-- Habilitar RLS si es necesario (asumimos que la autenticación está controlada por otro mecanismo o no es estricta para leer en este esquema)
