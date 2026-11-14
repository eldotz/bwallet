alter table public.ledgerly_transactions
  add column if not exists allocation_type text not null default 'common';

alter table public.ledgerly_transactions
  drop constraint if exists ledgerly_transactions_allocation_type_check;

alter table public.ledgerly_transactions
  add constraint ledgerly_transactions_allocation_type_check
  check (allocation_type in ('common', 'individual'));
