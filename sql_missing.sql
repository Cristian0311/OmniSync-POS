CREATE TABLE IF NOT EXISTS pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  table_number text,
  status text DEFAULT 'pending',
  total numeric NOT NULL,
  subtotal numeric NOT NULL,
  tax numeric NOT NULL,
  date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pending_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_order_id uuid REFERENCES pending_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  variant_label text,
  quantity integer NOT NULL,
  price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to pending_orders" ON pending_orders;
CREATE POLICY "Public access to pending_orders" ON pending_orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pending_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to pending_order_items" ON pending_order_items;
CREATE POLICY "Public access to pending_order_items" ON pending_order_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE returns ADD COLUMN IF NOT EXISTS variant_label text;
