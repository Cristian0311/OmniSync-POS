-- Table: quotes
create table if not exists quotes (
  id text primary key,
  branch_id text references branches(id),
  user_id text references users(id),
  customer_id text references customers(id),
  date timestamp with time zone not null,
  subtotal numeric not null,
  tax numeric not null,
  total numeric not null,
  status text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists quote_items (
  id text primary key,
  quote_id text references quotes(id) on delete cascade,
  product_id text references products(id),
  product_name text not null,
  quantity integer not null,
  price numeric not null,
  tax numeric not null,
  variant_label text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: time_shifts (Control de asistencia)
create table if not exists time_shifts (
  id text primary key,
  user_id text references users(id),
  clock_in timestamp with time zone not null,
  clock_out timestamp with time zone,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table time_shifts enable row level security;

create policy "Allow all for quotes" on quotes for all using (true);
create policy "Allow all for quote_items" on quote_items for all using (true);
create policy "Allow all for time_shifts" on time_shifts for all using (true);
