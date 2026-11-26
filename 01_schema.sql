-- ============================================================
-- TAJ RESTAURANT — database schema (Supabase / PostgreSQL)
-- Already applied to project: ppdzgsdfrptsoeuwszcu (taj-restaurant)
-- Keep this file as documentation / for re-creating the database.
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(name_ar) between 1 and 60),
  name_en text check (name_en is null or char_length(name_en) <= 60),
  note text check (note is null or char_length(note) <= 120),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  ingredients text check (ingredients is null or char_length(ingredients) <= 500),
  kind text not null default 'food' check (kind in ('food','drink')),
  price numeric(12,0) not null check (price >= 0),
  old_price numeric(12,0) check (old_price is null or old_price > 0),
  price_large numeric(12,0) check (price_large is null or price_large >= 0),
  image_url text check (image_url is null or char_length(image_url) <= 600),
  is_featured boolean not null default false,
  is_new boolean not null default false,
  is_available boolean not null default true,
  is_hidden boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'offer' check (kind in ('ad','offer')),
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 600),
  image_url text check (image_url is null or char_length(image_url) <= 600),
  discount_text text check (discount_text is null or char_length(discount_text) <= 40),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.orders (
  id bigint generated always as identity primary key,
  customer_name text check (customer_name is null or char_length(customer_name) <= 80),
  phone text check (phone is null or char_length(phone) <= 20),
  address text check (address is null or char_length(address) <= 300),
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'new' check (status in ('new','accepted','preparing','ready','completed','cancelled')),
  total numeric(12,0) not null default 0 check (total >= 0),
  items_count integer not null default 0 check (items_count >= 0),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders(status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  size text,
  qty integer not null check (qty between 1 and 50),
  unit_price numeric(12,0) not null check (unit_price >= 0)
);
create index order_items_order_idx on public.order_items(order_id);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_cat_touch before update on public.categories for each row execute function public.touch_updated_at();
create trigger trg_prod_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger trg_ann_touch before update on public.announcements for each row execute function public.touch_updated_at();
create trigger trg_ord_touch before update on public.orders for each row execute function public.touch_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.announcements enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admins enable row level security;

create policy cat_public_read on public.categories for select to anon, authenticated using (is_active);
create policy cat_admin_all on public.categories for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy prod_public_read on public.products for select to anon, authenticated using (not is_hidden);
create policy prod_admin_all on public.products for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ann_public_read on public.announcements for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy ann_admin_all on public.announcements for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ord_admin_all on public.orders for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy oi_admin_all on public.order_items for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admins_self_read on public.admins for select to authenticated using (user_id = (select auth.uid()));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.categories, public.products, public.announcements to anon;
grant select, insert, update, delete on public.categories, public.products, public.announcements to authenticated;
grant select, update, delete on public.orders, public.order_items to authenticated;
grant select on public.admins to authenticated;

-- Customers place orders ONLY through this function: it validates everything and
-- recomputes prices from the products table (prices sent by the browser are ignored).
create or replace function public.place_order(p_name text, p_phone text, p_address text, p_notes text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint; v_total numeric := 0; v_count integer := 0;
  it jsonb; r record; v_qty integer; v_size text; v_price numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 60 then
    raise exception 'سلة غير صالحة';
  end if;
  if char_length(coalesce(p_name,'')) > 80 or char_length(coalesce(p_phone,'')) > 20
     or char_length(coalesce(p_address,'')) > 300 or char_length(coalesce(p_notes,'')) > 500 then
    raise exception 'بيانات طويلة جداً';
  end if;
  if coalesce(p_phone,'') !~ '^[0-9+ -]*$' then raise exception 'رقم هاتف غير صالح'; end if;

  insert into public.orders(customer_name, phone, address, notes)
  values (nullif(trim(p_name),''), nullif(trim(p_phone),''), nullif(trim(p_address),''), nullif(trim(p_notes),''))
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::integer;
    v_size := coalesce(it->>'size','');
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'كمية غير صالحة'; end if;
    select * into r from public.products
      where id = (it->>'product_id')::uuid and not is_hidden and is_available;
    if not found then raise exception 'صنف غير متوفر'; end if;
    if v_size = 'كبير' then
      if r.price_large is null then raise exception 'حجم غير صالح'; end if;
      v_price := r.price_large;
    elsif v_size in ('', 'وسط') then
      v_price := r.price;
      if r.price_large is not null then v_size := 'وسط'; else v_size := ''; end if;
    else
      raise exception 'حجم غير صالح';
    end if;
    insert into public.order_items(order_id, product_id, name, size, qty, unit_price)
    values (v_id, r.id, r.name, nullif(v_size,''), v_qty, v_price);
    v_total := v_total + v_price * v_qty;
    v_count := v_count + v_qty;
  end loop;

  update public.orders set total = v_total, items_count = v_count where id = v_id;
  return jsonb_build_object('order_id', v_id, 'total', v_total, 'items_count', v_count);
end $$;
revoke execute on function public.place_order(text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,jsonb) to anon, authenticated;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Asia/Baghdad')::date;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  return jsonb_build_object(
    'products', (select count(*) from public.products),
    'categories', (select count(*) from public.categories),
    'orders', (select count(*) from public.orders),
    'new_orders', (select count(*) from public.orders where status = 'new'),
    'sales_total', (select coalesce(sum(total),0) from public.orders where status <> 'cancelled'),
    'periods', (
      select jsonb_build_object(
        'today', jsonb_build_object('orders', count(*) filter (where d = v_today), 'sales', coalesce(sum(total) filter (where d = v_today),0)),
        'week',  jsonb_build_object('orders', count(*) filter (where d >= v_today - 6), 'sales', coalesce(sum(total) filter (where d >= v_today - 6),0)),
        'month', jsonb_build_object('orders', count(*) filter (where d >= date_trunc('month', v_today)::date), 'sales', coalesce(sum(total) filter (where d >= date_trunc('month', v_today)::date),0))
      )
      from (select (created_at at time zone 'Asia/Baghdad')::date as d, total from public.orders where status <> 'cancelled') x
    ),
    'last7', (
      select coalesce(jsonb_agg(jsonb_build_object('day', g::text,
        'orders', (select count(*) from public.orders o where o.status <> 'cancelled' and (o.created_at at time zone 'Asia/Baghdad')::date = g),
        'sales', (select coalesce(sum(o.total),0) from public.orders o where o.status <> 'cancelled' and (o.created_at at time zone 'Asia/Baghdad')::date = g)
      ) order by g), '[]'::jsonb)
      from generate_series(v_today - 6, v_today, interval '1 day') as gs(g0), lateral (select gs.g0::date as g) q
    ),
    'top', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select oi.name, sum(oi.qty)::int as qty, sum(oi.qty * oi.unit_price) as revenue
        from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.status <> 'cancelled' group by oi.name order by sum(oi.qty) desc limit 8
      ) t
    )
  );
end $$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- Storage bucket for dish / offer images (public read, admin-only write, 5 MB, jpg/png/webp)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('taj-media', 'taj-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy taj_media_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'taj-media');
create policy taj_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'taj-media' and (select public.is_admin()));
create policy taj_media_admin_update on storage.objects for update to authenticated using (bucket_id = 'taj-media' and (select public.is_admin()));
create policy taj_media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'taj-media' and (select public.is_admin()));
