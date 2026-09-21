-- ==============================================================================
-- MARÉ POS - SISTEMA INTEGRAL DE GESTIÓN, CAJA, NÓMINA Y PUNTO DE VENTA
-- SCRIPT MIGRATORIO UNIVERSAL Y 100% SEGURO PARA SUPABASE (POSTGRESQL)
-- ==============================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CREACIÓN BASE DE TABLAS (SI NO EXISTEN)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.branches (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.currencies (code TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.categories (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.customers (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.users (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.products (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.inventory (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.cash_sessions (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.transactions (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.salary_settlements (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.bank_cards (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.bank_transactions (id TEXT PRIMARY KEY);

-- ==============================================================================
-- 3. MIGRACIÓN COMPLETA DE TODAS LAS COLUMNAS (AUTO-COMPATIBILIDAD TOTAL)
-- ==============================================================================

-- 3.1. SUCURSALES (Branches)
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Sucursal';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.2. MONEDAS (Currencies)
ALTER TABLE public.currencies ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Moneda';
ALTER TABLE public.currencies ADD COLUMN IF NOT EXISTS symbol TEXT DEFAULT '$';
ALTER TABLE public.currencies ADD COLUMN IF NOT EXISTS rate_to_base NUMERIC DEFAULT 1;
ALTER TABLE public.currencies ADD COLUMN IF NOT EXISTS is_base BOOLEAN DEFAULT false;
ALTER TABLE public.currencies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.3. CATEGORÍAS (Categories)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'General';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.4. CLIENTES (Customers)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Consumidor';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tax_id TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.5. USUARIOS Y EMPLEADOS (Users)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Usuario';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '1234';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sales_goal NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS supervisor_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allowed_branches JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["pos_access"]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.6. PRODUCTOS (Products)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Producto';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS margin NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'bg-slate-500';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'fixed';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_value NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unidad';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS has_serial BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_kit BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kit_components JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS device_color TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_sizes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_colors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS next_serial INTEGER DEFAULT 1;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.7. INVENTARIO (Inventory)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS variant_label TEXT DEFAULT '';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS min_quantity INTEGER DEFAULT 0;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.8. SESIONES / TURNOS DE CAJA (Cash Sessions)
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS closing_balances JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS expected_balance NUMERIC;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS worker_name TEXT DEFAULT 'Vendedor';
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS working_employee_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS movements JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS closing_date TIMESTAMPTZ;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.9. VENTAS Y TRANSACCIONES (Transactions)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS seller_employee_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'Vendedor';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ncf TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ncf_type TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS change_given NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS change_payments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.10. LIQUIDACIONES DE NÓMINA (Salary Settlements)
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT 'Vendedor';
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0;
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS sales_goal NUMERIC DEFAULT 0;
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS commissions NUMERIC DEFAULT 0;
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.salary_settlements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.11. BANCOS Y TARJETAS (Bank Cards & Transactions)
ALTER TABLE public.bank_cards ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT '';
ALTER TABLE public.bank_cards ADD COLUMN IF NOT EXISTS card_holder TEXT DEFAULT '';
ALTER TABLE public.bank_cards ADD COLUMN IF NOT EXISTS last_four_digits TEXT DEFAULT '';
ALTER TABLE public.bank_cards ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CUP';
ALTER TABLE public.bank_cards ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;
ALTER TABLE public.bank_cards ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'from-blue-600 to-indigo-800';
ALTER TABLE public.bank_cards ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.bank_cards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'payment_received';
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT '';
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ==============================================================================
-- 4. NORMALIZACIÓN AUTOMÁTICA DE TIPOS ARRAY A JSONB (PARA COMPATIBILIDAD SUPABASE)
-- ==============================================================================

DO $$
BEGIN
    -- Normalizar users.allowed_branches a jsonb si era text[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' 
        AND column_name = 'allowed_branches' AND data_type LIKE '%ARRAY%'
    ) THEN
        ALTER TABLE public.users ALTER COLUMN allowed_branches TYPE JSONB USING to_jsonb(allowed_branches);
    END IF;

    -- Normalizar users.permissions a jsonb si era text[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' 
        AND column_name = 'permissions' AND data_type LIKE '%ARRAY%'
    ) THEN
        ALTER TABLE public.users ALTER COLUMN permissions TYPE JSONB USING to_jsonb(permissions);
    END IF;

    -- Normalizar cash_sessions.working_employee_ids a jsonb si era text[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cash_sessions' 
        AND column_name = 'working_employee_ids' AND data_type LIKE '%ARRAY%'
    ) THEN
        ALTER TABLE public.cash_sessions ALTER COLUMN working_employee_ids TYPE JSONB USING to_jsonb(working_employee_ids);
    END IF;

    -- Normalizar transactions.seller_employee_ids a jsonb si era text[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'transactions' 
        AND column_name = 'seller_employee_ids' AND data_type LIKE '%ARRAY%'
    ) THEN
        ALTER TABLE public.transactions ALTER COLUMN seller_employee_ids TYPE JSONB USING to_jsonb(seller_employee_ids);
    END IF;
END $$;

-- ==============================================================================
-- 5. ÍNDICES DE ALTO RENDIMIENTO
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_users_name ON public.users(name);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_branch ON public.inventory(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch ON public.cash_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON public.cash_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_worker ON public.cash_sessions(worker_name);
CREATE INDEX IF NOT EXISTS idx_transactions_session ON public.transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_date ON public.transactions(branch_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON public.transactions(cashier_name);
CREATE INDEX IF NOT EXISTS idx_settlements_session ON public.salary_settlements(session_id);
CREATE INDEX IF NOT EXISTS idx_settlements_user ON public.salary_settlements(user_id);

-- ==============================================================================
-- 6. POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Permitir todo en branches" ON public.branches;
    CREATE POLICY "Permitir todo en branches" ON public.branches FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en users" ON public.users;
    CREATE POLICY "Permitir todo en users" ON public.users FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en currencies" ON public.currencies;
    CREATE POLICY "Permitir todo en currencies" ON public.currencies FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en categories" ON public.categories;
    CREATE POLICY "Permitir todo en categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en products" ON public.products;
    CREATE POLICY "Permitir todo en products" ON public.products FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en inventory" ON public.inventory;
    CREATE POLICY "Permitir todo en inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en customers" ON public.customers;
    CREATE POLICY "Permitir todo en customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en cash_sessions" ON public.cash_sessions;
    CREATE POLICY "Permitir todo en cash_sessions" ON public.cash_sessions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en transactions" ON public.transactions;
    CREATE POLICY "Permitir todo en transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en salary_settlements" ON public.salary_settlements;
    CREATE POLICY "Permitir todo en salary_settlements" ON public.salary_settlements FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en bank_cards" ON public.bank_cards;
    CREATE POLICY "Permitir todo en bank_cards" ON public.bank_cards FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en bank_transactions" ON public.bank_transactions;
    CREATE POLICY "Permitir todo en bank_transactions" ON public.bank_transactions FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- 7. DATOS SEMILLA INICIALES
-- ==============================================================================

-- Sucursal Principal
INSERT INTO public.branches (id, name, address, phone, is_main)
VALUES ('b-central', 'Sucursal Central', 'Calle Principal #100, La Habana, Cuba', '+53 5200-0000', true)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    is_main = EXCLUDED.is_main;

-- Monedas del Sistema
INSERT INTO public.currencies (code, name, symbol, rate_to_base, is_base)
VALUES 
    ('CUP', 'Peso Cubano', '$', 1, true),
    ('USD', 'Dólar Estadounidense', '$', 320, false),
    ('EUR', 'Euro', '€', 350, false),
    ('MN', 'Moneda Nacional', '$', 1, false)
ON CONFLICT (code) DO UPDATE SET 
    rate_to_base = EXCLUDED.rate_to_base,
    is_base = EXCLUDED.is_base;

-- Usuarios Iniciales (Admin y Trabajador con contraseña 03111166702)
INSERT INTO public.users (id, name, email, password, role, commission_rate, base_salary, sales_goal, branch_id, allowed_branches, permissions, is_active)
VALUES 
    (
        'admin-1',
        'Administrador Cristian',
        'cristianmarco2003@gmail.com',
        '03111166702',
        'admin',
        0,
        0,
        0,
        'b-central',
        '["b-central"]'::jsonb,
        '["pos_access", "reports_access", "inventory_access", "admin_access"]'::jsonb,
        true
    ),
    (
        'employee-1',
        'Trabajador General',
        'trabajador@gmail.com',
        '03111166702',
        'employee',
        0,
        0,
        0,
        'b-central',
        '["b-central"]'::jsonb,
        '["pos_access"]'::jsonb,
        true
    )
ON CONFLICT (id) DO UPDATE SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    name = EXCLUDED.name,
    allowed_branches = EXCLUDED.allowed_branches,
    permissions = EXCLUDED.permissions;

-- Tarjetas Bancarias Predeterminadas
INSERT INTO public.bank_cards (id, bank_name, card_holder, last_four_digits, currency, balance, color, is_active)
VALUES 
    ('bc-cup-1', 'BPA / BANDEC', 'MARÉ COMERCIAL', '8910', 'CUP', 0, 'from-blue-600 to-indigo-800', true),
    ('bc-usd-1', 'BPA MLC / USD', 'MARÉ COMERCIAL', '1234', 'USD', 0, 'from-emerald-600 to-teal-800', true)
ON CONFLICT (id) DO NOTHING;
