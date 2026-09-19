-- Fix transaction_items: missing cart_item_id column
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS cart_item_id text;

-- Fix inventory_levels: missing unique constraint for upsert/onConflict
-- First, we ensure there are no duplicates that would prevent creating the constraint
-- (This part is optional but recommended if the DB already has data)
-- DELETE FROM inventory_levels a USING inventory_levels b 
-- WHERE a.id < b.id 
--   AND a.product_id = b.product_id 
--   AND a.branch_id = b.branch_id 
--   AND (a.variant_label = b.variant_label OR (a.variant_label IS NULL AND b.variant_label IS NULL));

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_levels_product_id_branch_id_variant_label_key') THEN
        ALTER TABLE inventory_levels ADD CONSTRAINT inventory_levels_product_id_branch_id_variant_label_key UNIQUE (product_id, branch_id, variant_label);
    END IF;
END $$;

-- Fix cash_sessions: missing worker_name column
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS worker_name text;

-- Fix users: missing sales_goal column
ALTER TABLE users ADD COLUMN IF NOT EXISTS sales_goal numeric DEFAULT 0;
