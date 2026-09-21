DROP TABLE IF EXISTS pending_order_items CASCADE;
DROP TABLE IF EXISTS pending_orders CASCADE;

CREATE TABLE IF NOT EXISTS pending_orders (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  customer_name TEXT,
  table_number TEXT,
  status TEXT DEFAULT 'pending',
  total NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pending_order_items (
  id TEXT PRIMARY KEY,
  pending_order_id TEXT REFERENCES pending_orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_label TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to pending_orders" ON pending_orders;
CREATE POLICY "Public access to pending_orders" ON pending_orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pending_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to pending_order_items" ON pending_order_items;
CREATE POLICY "Public access to pending_order_items" ON pending_order_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE returns ADD COLUMN IF NOT EXISTS variant_label text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_independent BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS assigned_branch_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_value NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'fixed';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_kit BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kit_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_sizes TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_colors TEXT[] DEFAULT '{}';
