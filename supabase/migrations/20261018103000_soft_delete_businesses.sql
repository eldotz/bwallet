alter table public.ledgerly_businesses
  add column if not exists archived_at timestamptz;

alter table public.ledgerly_businesses
  drop constraint if exists ledgerly_businesses_organization_id_name_key;

create unique index if not exists ledgerly_businesses_active_name_key
  on public.ledgerly_businesses (organization_id, name)
  where archived_at is null;
