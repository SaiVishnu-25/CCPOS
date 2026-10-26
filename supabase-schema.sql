-- ============================================================================
-- CCPOS — Supabase Schema
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'student'
    check (role in ('student','faculty','guest','staff','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. AUTO-CREATE PROFILE ON SIGNUP
-- Public signup is clamped to customer roles (student/faculty/guest).
-- Staff & admin accounts are created by an admin (via Edge Function) or
-- manually in the Supabase dashboard.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data->>'role', 'student');
  safe_role text;
begin
  if requested in ('student','faculty','guest') then
    safe_role := requested;
  else
    safe_role := 'student';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    safe_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. ROLE HELPER FUNCTIONS (SECURITY DEFINER avoids RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff','admin') and active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. MENU ITEMS
-- ---------------------------------------------------------------------------
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Lunch',
  price numeric not null default 0,
  description text default '',
  emoji text default '🍽️',
  image_url text,
  prep_time int default 10,
  dietary text default 'Veg',
  available boolean not null default true,
  rating numeric default 4.5,
  badge text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. ORDERS + ORDER ITEMS
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  role text default 'student',
  status text not null default 'placed'
    check (status in ('placed','preparing','ready','completed','cancelled')),
  total numeric not null default 0,
  pickup_slot text,
  payment_method text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  menu_item_id uuid,
  name text,
  price numeric,
  qty int,
  emoji text,
  dietary text
);

-- ---------------------------------------------------------------------------
-- 6. FAVORITES
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid references auth.users(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  primary key (user_id, menu_item_id)
);

-- ---------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.menu_items   enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.favorites    enable row level security;

-- Profiles: users see themselves; staff see all; admin manages all.
-- NOTE: there is intentionally NO "update own profile" policy, so a user can
-- never promote themselves to staff/admin. Role changes are admin-only.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_staff());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Menu: everyone reads; staff/admin write.
drop policy if exists menu_select on public.menu_items;
create policy menu_select on public.menu_items
  for select using (true);

drop policy if exists menu_write on public.menu_items;
create policy menu_write on public.menu_items
  for all using (public.is_staff()) with check (public.is_staff());

-- Orders: own or staff/admin.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (auth.uid() = user_id or public.is_staff());

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (public.is_staff()) with check (public.is_staff());

-- Order items.
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())
    )
  );

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists order_items_update on public.order_items;
create policy order_items_update on public.order_items
  for update using (public.is_staff()) with check (public.is_staff());

-- Favorites: own only.
drop policy if exists favorites_all on public.favorites;
create policy favorites_all on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 8. SEED MENU (safe: only inserts when the table is empty)
-- ---------------------------------------------------------------------------
insert into public.menu_items
  (name, category, price, description, emoji, prep_time, dietary, available, rating, badge)
select v.name, v.category, v.price, v.description, v.emoji, v.prep_time, v.dietary, v.available, v.rating, v.badge
from (values
  ('Margherita Pizza','Lunch',120,'Classic wood-fired pizza with fresh basil, mozzarella and tomato.','🍕',15,'Veg',true,4.7,'Chef''s Special'),
  ('Cheese Burger','Lunch',95,'Juicy patty, cheddar, lettuce, tomato and our secret sauce.','🍔',12,'Non-Veg',true,4.6,'Popular'),
  ('Masala Dosa','Breakfast',60,'Crispy dosa with spiced potato filling and coconut chutney.','🥞',10,'Veg',true,4.8,''),
  ('French Fries','Snacks',50,'Golden crispy fries tossed with salt and peri-peri seasoning.','🍟',8,'Vegan',true,4.4,''),
  ('Cold Coffee','Drinks',45,'Chilled coffee blended with milk and ice, topped with cream.','🥤',5,'Veg',true,4.5,''),
  ('Paneer Wrap','Lunch',85,'Grilled paneer, veggies and mint mayo in a soft tortilla.','🌯',10,'Veg',true,4.6,''),
  ('Chicken Biryani','Lunch',150,'Fragrant basmati rice slow-cooked with spiced chicken.','🍛',20,'Non-Veg',true,4.9,'Popular'),
  ('Samosa','Snacks',25,'Crispy pastry filled with spiced potato and peas.','🥟',5,'Veg',true,4.3,''),
  ('Fresh Lime Soda','Drinks',30,'Refreshing lime soda, sweet or salted, served chilled.','🍋',4,'Vegan',true,4.2,''),
  ('Chocolate Brownie','Desserts',55,'Warm fudgy brownie with a molten chocolate centre.','🍩',6,'Veg',true,4.8,'Chef''s Special'),
  ('Veg Sandwich','Snacks',40,'Toasted sandwich with fresh veggies and cheese.','🥪',7,'Veg',true,4.1,''),
  ('Mango Smoothie','Drinks',50,'Thick and creamy mango smoothie made with fresh fruit.','🥭',5,'Vegan',false,4.5,'')
) as v(name, category, price, description, emoji, prep_time, dietary, available, rating, badge)
where not exists (select 1 from public.menu_items);

-- ---------------------------------------------------------------------------
-- 9. PROMOTE YOUR FIRST ADMIN
-- After signing up normally (role will be student), run this with YOUR email:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- Then create staff from the Admin Console (uses the admin-users Edge Function).
-- ---------------------------------------------------------------------------
