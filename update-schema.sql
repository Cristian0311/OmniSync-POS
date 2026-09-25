-- ============================================================================
-- ACTUALIZACIÓN DE ESQUEMA MARÉ E-COMMERCE / POS SUPABASE
-- Incluye: Auditoría, Soft Delete, Idempotencia, RPCs Atómicos y Vistas de Integridad
-- ============================================================================

-- 1. TABLAS Y COLUMNAS FUNDAMENTALES

-- Usuarios y Sucursales
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_id TEXT REFERENCES users(id);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone TEXT;

-- Asegurar unicidad semántica de sucursales/almacenes (evita duplicados sin importar mayúsculas o acentos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_normalized_name 
ON branches (lower(translate(trim(name), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN')));

-- Configuración y Contador Global de Turnos
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  store_config JSONB,
  catalog_config JSONB,
  receipt_config JSONB,
  currencies JSONB,
  last_turn_number INTEGER DEFAULT 0
);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS last_turn_number INTEGER DEFAULT 0;

-- Columnas de Auditoría y Soft Delete en Transacciones y Turnos de Caja
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS delete_reason TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS delete_reason TEXT;

-- Inventario
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS variant_label TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS min_quantity INTEGER DEFAULT 5;
-- Asegurar unicidad de variantes por sucursal
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_product_branch_variant_key'
  ) THEN
    ALTER TABLE inventory ADD CONSTRAINT inventory_product_branch_variant_key UNIQUE (product_id, branch_id, variant_label);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. TABLAS DE MÓDULOS EMPRESARIALES Y AUDITORÍA

-- Tabla de Auditoría Histórica Inmutable
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Auditorías de Inventario Físico
CREATE TABLE IF NOT EXISTS inventory_audits (
  id TEXT PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_audit_items (
  id TEXT PRIMARY KEY,
  audit_id TEXT REFERENCES inventory_audits(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  product_name TEXT NOT NULL,
  variant_label TEXT,
  expected INTEGER NOT NULL,
  actual INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Liquidaciones de Salario por Turno
CREATE TABLE IF NOT EXISTS salary_settlements (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  user_name TEXT NOT NULL,
  session_id TEXT REFERENCES cash_sessions(id),
  base_salary NUMERIC NOT NULL DEFAULT 0,
  commissions NUMERIC NOT NULL DEFAULT 0,
  discrepancy_deduction NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  sales_goal NUMERIC DEFAULT 0,
  date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. POLÍTICAS DE SEGURIDAD (RLS)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_settlements ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for settings') THEN
    CREATE POLICY "Allow all for settings" ON settings FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for audit_log') THEN
    CREATE POLICY "Allow all for audit_log" ON audit_log FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for inventory_audits') THEN
    CREATE POLICY "Allow all for inventory_audits" ON inventory_audits FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for inventory_audit_items') THEN
    CREATE POLICY "Allow all for inventory_audit_items" ON inventory_audit_items FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for salary_settlements') THEN
    CREATE POLICY "Allow all for salary_settlements" ON salary_settlements FOR ALL USING (true);
  END IF;
END $$;

-- 4. VISTAS DE INTEGRIDAD Y AUDITORÍA DE DATOS

-- Vista de turnos con ventas calculadas desde base de datos
CREATE OR REPLACE VIEW shift_audit_view AS
SELECT 
  s.id AS session_id,
  s.opened_at,
  s.closed_at,
  s.worker_name,
  s.branch_id,
  s.status,
  COALESCE(SUM(t.total), 0) AS computed_total_sales,
  COUNT(t.id) AS sales_count
FROM cash_sessions s
LEFT JOIN transactions t ON t.session_id = s.id AND t.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.opened_at, s.closed_at, s.worker_name, s.branch_id, s.status;

-- Alertas de Integridad Referencial
CREATE OR REPLACE VIEW data_integrity_alerts AS
SELECT 
  'TRANSACTION_WITHOUT_SESSION' AS alert_type, 
  id AS entity_id, 
  date AS entity_date, 
  'Venta sin turno asociado registrado' AS description
FROM transactions 
WHERE session_id IS NULL AND deleted_at IS NULL
UNION ALL
SELECT 
  'TRANSACTION_WITH_DELETED_SESSION' AS alert_type, 
  t.id AS entity_id, 
  t.date AS entity_date, 
  'Venta vinculada a turno eliminado lógicamente' AS description
FROM transactions t 
JOIN cash_sessions s ON t.session_id = s.id 
WHERE s.deleted_at IS NOT NULL AND t.deleted_at IS NULL;

-- 5. FUNCIONES ATÓMICAS TRANSACCIONALES (RPC)

-- 5.1 Apertura de Turno Atómica con Concurrencia Protegida
CREATE OR REPLACE FUNCTION open_cash_session_v2(
  p_user_id TEXT,
  p_worker_name TEXT,
  p_branch_id TEXT,
  p_opening_amount NUMERIC,
  p_opened_at TIMESTAMPTZ,
  p_working_employee_ids TEXT[],
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_next_turn INTEGER;
  v_session_id TEXT;
  v_result JSONB;
BEGIN
  -- Incrementar contador global con lock de fila automático
  INSERT INTO settings (id, last_turn_number)
  VALUES ('global', 1)
  ON CONFLICT (id) DO UPDATE
  SET last_turn_number = settings.last_turn_number + 1
  RETURNING last_turn_number INTO v_next_turn;

  v_session_id := 'Turno-' || v_next_turn;

  -- Crear sesión
  INSERT INTO cash_sessions (
    id, user_id, worker_name, branch_id, opened_at, opening_balance, opening_amount, status, working_employee_ids, notes, created_at
  )
  VALUES (
    v_session_id, p_user_id, p_worker_name, p_branch_id, p_opened_at, p_opening_amount, p_opening_amount, 'open', p_working_employee_ids, p_notes, NOW()
  )
  RETURNING row_to_json(cash_sessions.*)::JSONB INTO v_result;

  -- Registrar en auditoría
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_data)
  VALUES (p_user_id, 'OPEN_SESSION', 'cash_session', v_session_id, v_result);

  RETURN v_result;
END;
$$;

-- 5.2 Transacción POS Atómica con Descuento de Stock y Prevención de Duplicados
CREATE OR REPLACE FUNCTION process_pos_transaction_v2(
  p_id TEXT,
  p_branch_id TEXT,
  p_user_id TEXT,
  p_date TIMESTAMPTZ,
  p_total NUMERIC,
  p_tax NUMERIC,
  p_discount NUMERIC,
  p_items JSONB,
  p_payments JSONB,
  p_payment_method TEXT,
  p_session_id TEXT,
  p_customer_id TEXT,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Idempotencia: Si ya existe la transacción, retornar éxito sin duplicar
  IF EXISTS (SELECT 1 FROM transactions WHERE id = p_id) THEN
    RETURN jsonb_build_object('success', true, 'id', p_id, 'already_existed', true);
  END IF;

  -- 1. Insertar Transacción
  INSERT INTO transactions (
    id, branch_id, user_id, date, total, tax, discount, items, payments, payment_method, session_id, customer_id, notes, status, created_at
  )
  VALUES (
    p_id, p_branch_id, p_user_id, p_date, p_total, p_tax, p_discount, p_items, p_payments, p_payment_method, p_session_id, p_customer_id, p_notes, 'completed', NOW()
  );

  -- 2. Actualizar Inventario para cada item
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, quantity INTEGER, variant_label TEXT)
  LOOP
    UPDATE inventory
    SET quantity = GREATEST(0, quantity - v_item.quantity)
    WHERE product_id = v_item.product_id 
      AND branch_id = p_branch_id 
      AND (variant_label IS NOT DISTINCT FROM v_item.variant_label);
    
    IF NOT FOUND THEN
      INSERT INTO inventory (id, product_id, branch_id, variant_label, quantity, min_quantity)
      VALUES (gen_random_uuid()::text, v_item.product_id, p_branch_id, v_item.variant_label, -v_item.quantity, 5)
      ON CONFLICT (product_id, branch_id, variant_label) DO UPDATE
      SET quantity = inventory.quantity - EXCLUDED.quantity;
    END IF;
  END LOOP;

  -- 3. Auditoría
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, meta)
  VALUES (p_user_id, 'PROCESS_TRANSACTION', 'transaction', p_id, jsonb_build_object('total', p_total, 'session_id', p_session_id));

  RETURN jsonb_build_object('success', true, 'id', p_id);
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- 5.3 Cierre de Turno Atómico con Liquidación de Salario
CREATE OR REPLACE FUNCTION close_cash_session_v2(
  p_session_id TEXT,
  p_closing_balances JSONB,
  p_closed_at TIMESTAMPTZ,
  p_notes TEXT,
  p_settlement_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_settlement_id TEXT;
BEGIN
  -- 1. Actualizar Sesión
  UPDATE cash_sessions
  SET 
    status = 'closed',
    closed_at = p_closed_at,
    closing_balances = p_closing_balances,
    notes = p_notes,
    updated_at = NOW()
  WHERE id = p_session_id;

  -- 2. Crear Liquidación de Salario
  v_settlement_id := gen_random_uuid()::text;
  INSERT INTO salary_settlements (
    id, user_id, user_name, session_id, base_salary, commissions, total, discrepancy_deduction, date, status, created_at
  )
  VALUES (
    v_settlement_id,
    (p_settlement_data->>'userId'),
    (p_settlement_data->>'userName'),
    p_session_id,
    COALESCE((p_settlement_data->>'baseSalary')::NUMERIC, 0),
    COALESCE((p_settlement_data->>'commissions')::NUMERIC, 0),
    COALESCE((p_settlement_data->>'total')::NUMERIC, 0),
    COALESCE((p_settlement_data->>'discrepancyDeduction')::NUMERIC, 0),
    p_closed_at,
    'pending',
    NOW()
  );

  -- 3. Auditoría
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, meta)
  VALUES ((p_settlement_data->>'userId'), 'CLOSE_SESSION', 'cash_session', p_session_id, p_settlement_data);

  RETURN jsonb_build_object('success', true, 'session_id', p_session_id, 'settlement_id', v_settlement_id);
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
