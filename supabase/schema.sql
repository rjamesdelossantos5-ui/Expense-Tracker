-- =====================================================================
-- Daily Expense Tracker - Supabase schema
-- Paste into Supabase Dashboard -> SQL Editor -> Run. Safe to re-run.
-- No auth: the `anon` role gets full access to everything (single-user app).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- categories ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'expense' check (type in ('expense','income')),
  color text not null default '#6366f1',
  icon text not null default 'tag',
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_type_key on public.categories (name, type);

-- ---------- payment methods ----------
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- recurring transactions ----------
create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'expense' check (type in ('expense','income')),
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  note text not null default '',
  tags text[] not null default '{}',
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  start_date date not null default current_date,
  end_date date,
  last_generated_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- transactions ----------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'expense' check (type in ('expense','income')),
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  date date not null default current_date,
  time time not null default localtime,
  note text not null default '',
  tags text[] not null default '{}',
  recurring_id uuid references public.recurring_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on public.transactions (date desc, time desc);
create index if not exists transactions_category_idx on public.transactions (category_id);
create index if not exists transactions_payment_idx on public.transactions (payment_method_id);
create index if not exists transactions_tags_idx on public.transactions using gin (tags);
-- prevents a recurring item from generating the same day twice (nulls are distinct)
create unique index if not exists transactions_recurring_date_key on public.transactions (recurring_id, date);

-- ---------- day journal ----------
create table if not exists public.day_notes (
  date date primary key,
  note text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- budgets (category_id NULL = overall monthly budget) ----------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create unique index if not exists budgets_category_key
  on public.budgets ((coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- ---------- settings (single row) ----------
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  currency text not null default 'PHP',
  week_start integer not null default 0 check (week_start in (0,1)),
  updated_at timestamptz not null default now()
);

-- ---------- Row Level Security: allow anon everything ----------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','payment_methods','recurring_transactions',
    'transactions','day_notes','budgets','settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "anon full access" on public.%I', t);
    execute format(
      'create policy "anon full access" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;

-- ---------- seed data ----------
insert into public.categories (name, type, color, icon, sort_order) values
  ('Food',          'expense', '#f97316', 'utensils',       1),
  ('Transport',     'expense', '#3b82f6', 'bus',            2),
  ('Bills',         'expense', '#ef4444', 'receipt',        3),
  ('Shopping',      'expense', '#ec4899', 'shopping-bag',   4),
  ('Health',        'expense', '#10b981', 'heart-pulse',    5),
  ('Entertainment', 'expense', '#8b5cf6', 'clapperboard',   6),
  ('Education',     'expense', '#06b6d4', 'graduation-cap', 7),
  ('Groceries',     'expense', '#84cc16', 'shopping-cart',  8),
  ('Others',        'expense', '#64748b', 'more-horizontal',9),
  ('Salary',        'income',  '#22c55e', 'briefcase',      1),
  ('Other Income',  'income',  '#14b8a6', 'coins',          2)
on conflict (name, type) do nothing;

insert into public.payment_methods (name, sort_order) values
  ('Cash', 1), ('Card', 2), ('E-Wallet', 3), ('Bank Transfer', 4), ('Other', 5)
on conflict (name) do nothing;

insert into public.settings (id, currency, week_start) values (1, 'PHP', 0)
on conflict (id) do nothing;
