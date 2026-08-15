-- ULTIMATE SQL PARA SUPABASE
-- 1. TABLAS PRINCIPALES (Asegurarse de que existan)

-- 2. INTEGRIDAD REFERENCIAL (CASCADA)
ALTER TABLE inventory_levels
  DROP CONSTRAINT IF EXISTS inventory_levels_product_id_fkey,
  ADD CONSTRAINT inventory_levels_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE inventory_levels
  DROP CONSTRAINT IF EXISTS inventory_levels_branch_id_fkey,
  ADD CONSTRAINT inventory_levels_branch_id_fkey 
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;

-- 3. BLINDAR TRANSFERENCIAS Y UPSERTS (Evitar duplicidad en inventarios)
ALTER TABLE inventory_levels
  DROP CONSTRAINT IF EXISTS unique_product_branch_variant;

ALTER TABLE inventory_levels
  ADD CONSTRAINT unique_product_branch_variant 
  UNIQUE NULLS NOT DISTINCT (product_id, branch_id, variant_label);

-- 4. PREVENCIÓN DE STOCK NEGATIVO
ALTER TABLE inventory_levels
  DROP CONSTRAINT IF EXISTS check_positive_quantity;

ALTER TABLE inventory_levels
  ADD CONSTRAINT check_positive_quantity 
  CHECK (quantity >= 0);

ALTER TABLE inventory_levels
  DROP CONSTRAINT IF EXISTS check_positive_min_quantity;

ALTER TABLE inventory_levels
  ADD CONSTRAINT check_positive_min_quantity 
  CHECK (min_quantity >= 0);

-- 5. REGLAS RLS Y POLÍTICAS SEGURAS
-- Para branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to branches" ON branches;
CREATE POLICY "Public access to branches" ON branches FOR ALL USING (true) WITH CHECK (true);

-- Para products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to products" ON products;
CREATE POLICY "Public access to products" ON products FOR ALL USING (true) WITH CHECK (true);

-- Para inventory_levels
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to inventory_levels" ON inventory_levels;
CREATE POLICY "Public access to inventory_levels" ON inventory_levels FOR ALL USING (true) WITH CHECK (true);

-- Para transactions y transfers
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to transfers" ON inventory_transfers;
CREATE POLICY "Public access to transfers" ON inventory_transfers FOR ALL USING (true) WITH CHECK (true);
