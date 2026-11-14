create extension if not exists pgcrypto;

create table if not exists public.ledgerly_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.ledgerly_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.ledgerly_organizations(id) on delete cascade,
  name text not null,
  role text not null default 'partner',
  created_at timestamptz not null default now()
);

create table if not exists public.ledgerly_businesses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ledgerly_organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.ledgerly_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ledgerly_organizations(id) on delete cascade,
  user_id uuid not null references public.ledgerly_profiles(id),
  taken_by_user_id uuid references public.ledgerly_profiles(id),
  business_id uuid references public.ledgerly_businesses(id),
  description text not null,
  category text not null,
  type text not null,
  entry_type text not null default 'spend',
  source text not null default 'wallet',
  amount bigint not null,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.ledgerly_audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.ledgerly_organizations(id) on delete cascade,
  user_id uuid not null references public.ledgerly_profiles(id),
  transaction_id uuid references public.ledgerly_transactions(id) on delete cascade,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ledgerly_transactions_org_date on public.ledgerly_transactions (organization_id, occurred_on desc);
create index if not exists ledgerly_transactions_business on public.ledgerly_transactions (business_id);
create index if not exists ledgerly_audit_logs_transaction on public.ledgerly_audit_logs (transaction_id, created_at desc);

alter table public.ledgerly_organizations enable row level security;
alter table public.ledgerly_profiles enable row level security;
alter table public.ledgerly_businesses enable row level security;
alter table public.ledgerly_transactions enable row level security;
alter table public.ledgerly_audit_logs enable row level security;
