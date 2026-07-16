create table if not exists settings (
  id text primary key,
  store_config jsonb,
  catalog_config jsonb,
  receipt_config jsonb,
  currencies jsonb
);
