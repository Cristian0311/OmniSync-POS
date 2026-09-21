-- ==============================================================================
-- MARÉ POS - SCRIPT DE DATOS DE PRUEBA (SEEDING COMPLETO PARA TESTING)
-- Este script inserta: Sucursales/Almacenes, Categorías, Productos con precios
-- y comisiones, Stock en inventario, Vendedores con salarios, Clientes y Tarjetas.
-- ==============================================================================

-- 1. SUCURSALES Y ALMACENES
INSERT INTO public.branches (id, name, address, phone, is_main)
VALUES 
    ('b-central', 'Sucursal Central (Tienda Principal)', 'Calle 23 esq. L, Vedado, La Habana', '+53 5200-1122', true),
    ('b-almacen-1', 'Almacén General de Distribución', 'Zona Industrial Berroa Nave 4', '+53 5300-3344', false),
    ('b-vedado', 'Sucursal Vedado Boutique', 'Calle Línea entre Paseo y A, Plaza', '+53 5400-5566', false),
    ('b-playa', 'Sucursal Playa 5ta Avenida', '5ta Ave e/ 84 y 86, Miramar, Playa', '+53 5500-7788', false)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    is_main = EXCLUDED.is_main;

-- 2. MONEDAS DEL SISTEMA
INSERT INTO public.currencies (code, name, symbol, rate_to_base, is_base)
VALUES 
    ('CUP', 'Peso Cubano', '$', 1, true),
    ('USD', 'Dólar Estadounidense', '$', 320, false),
    ('EUR', 'Euro', '€', 350, false),
    ('MN', 'Moneda Nacional', '$', 1, false)
ON CONFLICT (code) DO UPDATE SET 
    rate_to_base = EXCLUDED.rate_to_base,
    is_base = EXCLUDED.is_base;

-- 3. CATEGORÍAS DE PRODUCTOS
INSERT INTO public.categories (id, name, department)
VALUES 
    ('cat-telefonia', 'Smartphones y Telefonía', 'Dispositivos'),
    ('cat-accesorios', 'Accesorios y Audio', 'Electrónica'),
    ('cat-computo', 'Laptops e Informática', 'Computación'),
    ('cat-repuestos', 'Repuestos y Baterías', 'Taller'),
    ('cat-servicios', 'Servicios Técnicos y Software', 'Servicios')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    department = EXCLUDED.department;

-- 4. USUARIOS / EMPLEADOS CON SALARIO BASE, METAS Y COMISIONES
INSERT INTO public.users (id, name, email, password, role, commission_rate, base_salary, sales_goal, branch_id, allowed_branches, permissions, is_active)
VALUES 
    (
        'admin-1',
        'Administrador Cristian',
        'cristianmarco2003@gmail.com',
        '03111166702',
        'admin',
        0,
        25000,
        1000000,
        'b-central',
        '["b-central", "b-almacen-1", "b-vedado", "b-playa"]'::jsonb,
        '["pos_access", "reports_access", "inventory_access", "admin_access", "cash_audit"]'::jsonb,
        true
    ),
    (
        'employee-1',
        'Trabajador General',
        'trabajador@gmail.com',
        '03111166702',
        'employee',
        3.5,
        12000,
        350000,
        'b-central',
        '["b-central", "b-vedado"]'::jsonb,
        '["pos_access"]'::jsonb,
        true
    ),
    (
        'user-alejandro',
        'Alejandro Martínez',
        'alejandro.vedado@gmail.com',
        '03111166702',
        'employee',
        5.0,
        16000,
        500000,
        'b-vedado',
        '["b-vedado"]'::jsonb,
        '["pos_access"]'::jsonb,
        true
    ),
    (
        'user-beatriz',
        'Beatriz Navarro',
        'beatriz.central@gmail.com',
        '03111166702',
        'employee',
        4.0,
        15000,
        450000,
        'b-central',
        '["b-central"]'::jsonb,
        '["pos_access"]'::jsonb,
        true
    ),
    (
        'user-carlos',
        'Carlos Delgado',
        'carlos.playa@gmail.com',
        '03111166702',
        'employee',
        5.0,
        18000,
        600000,
        'b-playa',
        '["b-playa"]'::jsonb,
        '["pos_access"]'::jsonb,
        true
    )
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    commission_rate = EXCLUDED.commission_rate,
    base_salary = EXCLUDED.base_salary,
    sales_goal = EXCLUDED.sales_goal,
    branch_id = EXCLUDED.branch_id,
    allowed_branches = EXCLUDED.allowed_branches,
    permissions = EXCLUDED.permissions;

-- 5. PRODUCTOS DE PRUEBA (PRECIO, COSTO, MARGEN, COMISIÓN)
INSERT INTO public.products (id, name, sku, barcode, cost_price, price, margin, category_id, color, commission_type, commission_value, unit, status, min_stock_alert, has_serial, warranty_days, is_kit, device_color, available_sizes, available_colors)
VALUES 
    (
        'prod-ip15pm',
        'iPhone 15 Pro Max 256GB Titanio Natural',
        'IP15PM-256-NAT',
        '195949038291',
        285000,
        340000,
        19.3,
        'cat-telefonia',
        'bg-slate-600',
        'fixed',
        3000,
        'unidad',
        'active',
        3,
        true,
        90,
        false,
        'Titanio Natural',
        '["256GB", "512GB", "1TB"]'::jsonb,
        '["Natural", "Azul", "Negro", "Blanco"]'::jsonb
    ),
    (
        'prod-s24u',
        'Samsung Galaxy S24 Ultra 512GB Gray',
        'S24U-512-GRY',
        '880609538192',
        260000,
        315000,
        21.15,
        'cat-telefonia',
        'bg-zinc-700',
        'fixed',
        2500,
        'unidad',
        'active',
        3,
        true,
        90,
        false,
        'Titanium Gray',
        '["256GB", "512GB"]'::jsonb,
        '["Gray", "Black", "Violet"]'::jsonb
    ),
    (
        'prod-rn13p',
        'Xiaomi Redmi Note 13 Pro+ 5G 256GB',
        'RN13P-256-BLK',
        '694181275482',
        68000,
        88000,
        29.41,
        'cat-telefonia',
        'bg-purple-600',
        'percentage',
        2.5,
        'unidad',
        'active',
        5,
        true,
        60,
        false,
        'Midnight Black',
        '["256GB", "512GB"]'::jsonb,
        '["Midnight Black", "Aurora Purple"]'::jsonb
    ),
    (
        'prod-airpods2',
        'Apple AirPods Pro (2da Generación USB-C)',
        'APP2-USBC-WHT',
        '195949052679',
        46000,
        62000,
        34.78,
        'cat-accesorios',
        'bg-emerald-600',
        'fixed',
        1000,
        'unidad',
        'active',
        5,
        true,
        30,
        false,
        'Blanco',
        '["Estándar"]'::jsonb,
        '["Blanco"]'::jsonb
    ),
    (
        'prod-charger20w',
        'Cargador Rápido 20W USB-C Power Delivery',
        'CHG-20W-PD',
        '742701928374',
        2200,
        4800,
        118.18,
        'cat-accesorios',
        'bg-blue-500',
        'fixed',
        200,
        'unidad',
        'active',
        15,
        false,
        30,
        false,
        'Blanco',
        '["20W", "35W"]'::jsonb,
        '["Blanco", "Negro"]'::jsonb
    ),
    (
        'prod-cable-c',
        'Cable USB-C a USB-C Trenzado 60W 2 Metros',
        'CBL-CC-2M-BLK',
        '742701928481',
        1100,
        2600,
        136.36,
        'cat-accesorios',
        'bg-amber-600',
        'fixed',
        150,
        'unidad',
        'active',
        20,
        false,
        15,
        false,
        'Negro',
        '["1m", "2m"]'::jsonb,
        '["Negro", "Gris"]'::jsonb
    ),
    (
        'prod-case-mag',
        'Funda Case MagSafe Silicona ShockProof',
        'CS-MAG-SIL',
        '742701928599',
        1400,
        3500,
        150.0,
        'cat-accesorios',
        'bg-rose-500',
        'fixed',
        200,
        'unidad',
        'active',
        20,
        false,
        7,
        false,
        'Transparente',
        '["iPhone 15", "iPhone 15 Pro", "iPhone 15 Pro Max"]'::jsonb,
        '["Transparente", "Negro Mate", "Azul Marino"]'::jsonb
    ),
    (
        'prod-glass-9d',
        'Protector Cerámico Cristal Templado 9D',
        'GLS-9D-PRIV',
        '742701928612',
        700,
        1900,
        171.42,
        'cat-accesorios',
        'bg-indigo-500',
        'fixed',
        100,
        'unidad',
        'active',
        25,
        false,
        7,
        false,
        'Privacidad',
        '["Full Cover"]'::jsonb,
        '["Transparente", "Privacidad"]'::jsonb
    ),
    (
        'prod-bat-ip11',
        'Batería Reemplazo Original iPhone 11 (3110 mAh)',
        'BAT-IP11-OEM',
        '742701928723',
        5800,
        11500,
        98.27,
        'cat-repuestos',
        'bg-teal-600',
        'fixed',
        600,
        'unidad',
        'active',
        8,
        true,
        60,
        false,
        'OEM',
        '["3110 mAh"]'::jsonb,
        '["Estándar"]'::jsonb
    ),
    (
        'prod-serv-maint',
        'Servicio Mantenimiento General y Cambio de Pasta',
        'SRV-MAINT-GEN',
        '000000000001',
        600,
        4500,
        650.0,
        'cat-servicios',
        'bg-violet-600',
        'percentage',
        10.0,
        'servicio',
        'active',
        1,
        false,
        15,
        false,
        'Taller',
        '["Completo"]'::jsonb,
        '["N/A"]'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    cost_price = EXCLUDED.cost_price,
    price = EXCLUDED.price,
    margin = EXCLUDED.margin,
    category_id = EXCLUDED.category_id,
    commission_type = EXCLUDED.commission_type,
    commission_value = EXCLUDED.commission_value,
    min_stock_alert = EXCLUDED.min_stock_alert;

-- 6. STOCK / INVENTARIO DISTRIBUIDO POR SUCURSAL Y ALMACÉN
-- Asegurar índice único para ON CONFLICT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_inventory_product_branch_variant'
    ) THEN
        ALTER TABLE public.inventory 
        ADD CONSTRAINT uq_inventory_product_branch_variant UNIQUE (product_id, branch_id, variant_label);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

INSERT INTO public.inventory (id, product_id, branch_id, variant_label, quantity, min_quantity)
VALUES 
    -- Sucursal Central (Tienda)
    (gen_random_uuid(), 'prod-ip15pm', 'b-central', '256GB - Natural', 8, 2),
    (gen_random_uuid(), 'prod-s24u', 'b-central', '512GB - Gray', 6, 2),
    (gen_random_uuid(), 'prod-rn13p', 'b-central', '256GB - Black', 14, 3),
    (gen_random_uuid(), 'prod-airpods2', 'b-central', 'Estándar', 12, 3),
    (gen_random_uuid(), 'prod-charger20w', 'b-central', '20W - Blanco', 45, 10),
    (gen_random_uuid(), 'prod-cable-c', 'b-central', '2m - Negro', 60, 15),
    (gen_random_uuid(), 'prod-case-mag', 'b-central', 'iPhone 15 Pro Max', 35, 8),
    (gen_random_uuid(), 'prod-glass-9d', 'b-central', 'Full Cover', 75, 15),
    (gen_random_uuid(), 'prod-bat-ip11', 'b-central', '3110 mAh', 10, 2),
    (gen_random_uuid(), 'prod-serv-maint', 'b-central', 'Servicio', 999, 1),

    -- Almacén General de Distribución (Stock mayorista)
    (gen_random_uuid(), 'prod-ip15pm', 'b-almacen-1', '256GB - Natural', 25, 5),
    (gen_random_uuid(), 'prod-s24u', 'b-almacen-1', '512GB - Gray', 20, 5),
    (gen_random_uuid(), 'prod-rn13p', 'b-almacen-1', '256GB - Black', 40, 10),
    (gen_random_uuid(), 'prod-airpods2', 'b-almacen-1', 'Estándar', 30, 5),
    (gen_random_uuid(), 'prod-charger20w', 'b-almacen-1', '20W - Blanco', 150, 25),
    (gen_random_uuid(), 'prod-cable-c', 'b-almacen-1', '2m - Negro', 200, 30),
    (gen_random_uuid(), 'prod-case-mag', 'b-almacen-1', 'iPhone 15 Pro Max', 120, 20),
    (gen_random_uuid(), 'prod-glass-9d', 'b-almacen-1', 'Full Cover', 300, 50),
    (gen_random_uuid(), 'prod-bat-ip11', 'b-almacen-1', '3110 mAh', 50, 10),

    -- Sucursal Vedado
    (gen_random_uuid(), 'prod-ip15pm', 'b-vedado', '256GB - Natural', 4, 1),
    (gen_random_uuid(), 'prod-s24u', 'b-vedado', '512GB - Gray', 4, 1),
    (gen_random_uuid(), 'prod-airpods2', 'b-vedado', 'Estándar', 8, 2),
    (gen_random_uuid(), 'prod-charger20w', 'b-vedado', '20W - Blanco', 25, 5),
    (gen_random_uuid(), 'prod-glass-9d', 'b-vedado', 'Full Cover', 40, 10),

    -- Sucursal Playa
    (gen_random_uuid(), 'prod-ip15pm', 'b-playa', '256GB - Natural', 5, 1),
    (gen_random_uuid(), 'prod-s24u', 'b-playa', '512GB - Gray', 5, 1),
    (gen_random_uuid(), 'prod-charger20w', 'b-playa', '20W - Blanco', 30, 5),
    (gen_random_uuid(), 'prod-cable-c', 'b-playa', '2m - Negro', 35, 8)
ON CONFLICT (product_id, branch_id, variant_label) DO UPDATE SET 
    quantity = EXCLUDED.quantity,
    min_quantity = EXCLUDED.min_quantity;

-- 7. TARJETAS BANCARIAS Y CUENTAS PARA COBROS EN TRANSFERENCIA
INSERT INTO public.bank_cards (id, bank_name, card_holder, last_four_digits, currency, balance, color, is_active)
VALUES 
    ('bc-cup-bpa', 'BPA Transfermóvil (CUP)', 'MARÉ INVERSIONES S.U.R.L', '8910', 'CUP', 350000, 'from-blue-600 to-indigo-800', true),
    ('bc-cup-bandec', 'BANDEC EnZona (CUP)', 'MARÉ INVERSIONES S.U.R.L', '4421', 'CUP', 185000, 'from-cyan-600 to-blue-700', true),
    ('bc-cup-banmet', 'BANMET Pago Móvil (CUP)', 'MARÉ COMERCIAL', '6732', 'CUP', 95000, 'from-indigo-600 to-purple-800', true),
    ('bc-usd-mlc', 'BPA Cuenta MLC / USD', 'MARÉ IMPORT & EXPORT', '1234', 'USD', 4250, 'from-emerald-600 to-teal-800', true)
ON CONFLICT (id) DO UPDATE SET 
    bank_name = EXCLUDED.bank_name,
    balance = EXCLUDED.balance,
    is_active = EXCLUDED.is_active;

-- 8. CLIENTES PARA PRUEBAS DE VENTA
INSERT INTO public.customers (id, name, email, phone, tax_id)
VALUES 
    ('cst-1', 'Consumidor Final', 'ventas@marepos.cu', '+53 5000-0000', '00000000000'),
    ('cst-2', 'Juan Carlos Pérez', 'juan.perez@gmail.com', '+53 5345-6789', '88041212345'),
    ('cst-3', 'María Elena Rodríguez', 'maria.rodriguez@nauta.cu', '+53 5890-1234', '92082567890'),
    ('cst-4', 'Soluciones Digitales Caribe S.U.R.L', 'contabilidad@solucionescaribe.cu', '+53 7832-4567', 'B12345678')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    phone = EXCLUDED.phone;

-- ==============================================================================
-- FIN DEL SCRIPT DE SEEDING
-- ==============================================================================
