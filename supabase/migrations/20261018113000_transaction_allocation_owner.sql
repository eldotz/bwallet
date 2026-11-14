alter table public.ledgerly_transactions
  add column if not exists allocation_user_id uuid references public.ledgerly_profiles(id);

create index if not exists ledgerly_transactions_allocation_user
  on public.ledgerly_transactions (allocation_user_id);
