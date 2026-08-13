ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS cart_item_id text;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS warranty_code text;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS selected_size text;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS selected_color text;
