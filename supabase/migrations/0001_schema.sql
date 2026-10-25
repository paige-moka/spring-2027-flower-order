-- Spring 2027 Flower Order: database schema
-- Run this first in the Supabase SQL Editor (or with `supabase db push`).
--
-- SECURITY MODEL
--   * Row level security is ON for every table and there are NO policies for the public (anon) or
--     signed in (authenticated) roles. That means the public Supabase key cannot read or change anything.
--   * All reads and writes happen on the server (Next.js API routes) with the service role key,
--     which is kept in Vercel environment variables and never sent to the browser.
--   * Customers can only see their own order by giving both the order reference and the email used,
--     and that check happens on the server.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- settings (one row)
create table if not exists public.app_settings (
  id             smallint primary key default 1 check (id = 1),
  orders_open    boolean      not null default true,
  order_deadline timestamptz  not null default '2026-11-11 06:59:00+00', -- Nov 10, 2026 11:59 pm Mountain Time
  updated_at     timestamptz  not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------- products (from the catalogue PDF)
create table if not exists public.products (
  item_no        integer primary key check (item_no > 0),
  family         text    not null,
  name           text    not null,
  size           text    not null,
  price_cents    integer not null check (price_cents > 0),
  catalogue_page integer not null,
  active         boolean not null default true
);

-- ---------------------------------------------------------------- orders
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique check (reference ~ '^SP27-[A-Z0-9]{6}$'),
  status           text not null default 'new' check (status in ('new', 'under_review', 'confirmed', 'cancelled')),
  customer_name    text not null check (char_length(customer_name) between 2 and 120),
  email            text not null check (char_length(email) between 3 and 160),
  phone            text not null check (char_length(phone) between 7 and 30),
  notes            text not null default '' check (char_length(notes) <= 2000),
  special_requests text not null default '' check (char_length(special_requests) <= 2000),
  subtotal_cents   integer not null check (subtotal_cents >= 0),
  gst_cents        integer not null check (gst_cents >= 0),
  total_cents      integer not null,
  item_count       integer not null check (item_count > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint orders_total_matches check (total_cents = subtotal_cents + gst_cents)
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_email_idx on public.orders (lower(email));
create index if not exists orders_status_idx on public.orders (status);

-- ---------------------------------------------------------------- order lines (price copied at the time of order)
create table if not exists public.order_items (
  id               bigint generated always as identity primary key,
  order_id         uuid    not null references public.orders(id) on delete cascade,
  item_no          integer not null references public.products(item_no),
  family           text    not null,
  name             text    not null,
  size             text    not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity         integer not null check (quantity between 1 and 500),
  line_total_cents integer not null,
  constraint order_items_line_matches check (line_total_cents = unit_price_cents * quantity),
  constraint order_items_unique_item unique (order_id, item_no)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------- email log (every attempt, so nothing is lost)
create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  kind        text not null check (kind in ('customer', 'monica')),
  recipient   text not null,
  status      text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_id text,
  error       text,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists email_log_order_idx on public.email_log (order_id);

-- ---------------------------------------------------------------- audit trail
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  order_id   uuid references public.orders(id) on delete cascade,  -- null for settings changes
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  actor      text not null,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_order_idx on public.audit_log (order_id, created_at desc);

-- ---------------------------------------------------------------- updated_at helper
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
drop trigger if exists email_log_touch on public.email_log;
create trigger email_log_touch before update on public.email_log for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.app_settings;
create trigger settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- create an order and its lines in ONE transaction
-- The database checks every price against the products table again, so a wrong price can never be saved.
create or replace function public.create_order(p_order jsonb, p_items jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_item jsonb;
  v_price integer;
  v_sub integer := 0;
  v_count integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order has no items';
  end if;

  insert into public.orders (reference, customer_name, email, phone, notes, special_requests,
                             subtotal_cents, gst_cents, total_cents, item_count)
  values (p_order->>'reference', p_order->>'customer_name', lower(p_order->>'email'), p_order->>'phone',
          coalesce(p_order->>'notes', ''), coalesce(p_order->>'special_requests', ''),
          (p_order->>'subtotal_cents')::int, (p_order->>'gst_cents')::int, (p_order->>'total_cents')::int,
          (p_order->>'item_count')::int)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select price_cents into v_price from public.products
      where item_no = (v_item->>'item_no')::int and active;
    if v_price is null then
      raise exception 'item % is not available', v_item->>'item_no';
    end if;
    if v_price <> (v_item->>'unit_price_cents')::int then
      raise exception 'price mismatch for item %', v_item->>'item_no';
    end if;
    insert into public.order_items (order_id, item_no, family, name, size, unit_price_cents, quantity, line_total_cents)
    values (v_id, (v_item->>'item_no')::int, v_item->>'family', v_item->>'name', v_item->>'size',
            v_price, (v_item->>'quantity')::int, v_price * (v_item->>'quantity')::int);
    v_sub := v_sub + v_price * (v_item->>'quantity')::int;
    v_count := v_count + (v_item->>'quantity')::int;
  end loop;

  if v_sub <> (p_order->>'subtotal_cents')::int or v_count <> (p_order->>'item_count')::int then
    raise exception 'order totals do not match the items';
  end if;

  insert into public.audit_log (order_id, action, detail, actor)
  values (v_id, 'order_created', jsonb_build_object('reference', p_order->>'reference', 'total_cents', (p_order->>'total_cents')::int), 'customer');

  return v_id;
end $$;

-- ---------------------------------------------------------------- lock everything down
alter table public.app_settings enable row level security;
alter table public.products     enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.email_log    enable row level security;
alter table public.audit_log    enable row level security;

-- No policies are created for anon or authenticated, so those roles see nothing.
revoke all on public.app_settings, public.products, public.orders, public.order_items, public.email_log, public.audit_log
  from anon, authenticated;
revoke all on function public.create_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb) to service_role;
grant all on public.app_settings, public.products, public.orders, public.order_items, public.email_log, public.audit_log
  to service_role;
grant usage, select on all sequences in schema public to service_role;
