-- Allow host chip redistribution: an 'adjustment' ledger type that moves chips
-- between seats (or rebalances stacks) WITHOUT touching total_buy_in, so the
-- net-vs-buyin settlement stays meaningful.

alter table public.chip_ledger drop constraint chip_ledger_type_check;
alter table public.chip_ledger add constraint chip_ledger_type_check
  check (type in ('buy_in','bet','payout','insurance','insurance_payout','refund','adjustment'));
