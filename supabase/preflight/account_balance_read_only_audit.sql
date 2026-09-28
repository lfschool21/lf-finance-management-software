-- Read-only production audit for zero-baseline account balances.
-- Run manually in the intended Supabase project's SQL editor and save all
-- result grids. This script never mutates financial data.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5min';
SET LOCAL lock_timeout = '5s';

SELECT
  current_database() AS database_name,
  current_user AS database_role,
  current_setting('transaction_read_only') AS transaction_read_only,
  now() AS snapshot_started_at;

-- Reports the exact number of preserved legacy non-zero openings.
SELECT
  count(*)::BIGINT AS total_accounts,
  count(*) FILTER (WHERE starting_balance <> 0)::BIGINT AS non_zero_stored_openings,
  COALESCE(sum(starting_balance) FILTER (WHERE starting_balance <> 0), 0) AS stored_opening_total
FROM public.accounts;

-- Per-account reconciliation. calculated_balance is the application balance.
WITH account_reconciliation AS (
  SELECT
    a.id,
    a.user_id,
    a.name,
    a.type,
    a.is_archived,
    a.starting_balance AS preserved_legacy_opening,
    COALESCE((SELECT sum(i.amount) FROM public.income_entries i WHERE i.account_id = a.id), 0) AS total_income,
    COALESCE((SELECT sum(e.amount) FROM public.expense_entries e WHERE e.account_id = a.id), 0) AS total_expenses,
    COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.to_account_id = a.id), 0) AS transfers_in,
    COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.from_account_id = a.id), 0) AS transfers_out,
    COALESCE((SELECT sum(r.original_amount) FROM public.recoverables r WHERE r.source_account_id = a.id), 0) AS advances_given,
    COALESCE((SELECT sum(p.amount) FROM public.recoverable_repayments p WHERE p.account_id = a.id), 0) AS recoveries_received
  FROM public.accounts a
)
SELECT
  *,
  total_income - total_expenses + transfers_in - transfers_out
    - advances_given + recoveries_received AS calculated_balance
FROM account_reconciliation
ORDER BY user_id, name, id;

-- Per-owner aggregate invariant: internal transfers cancel across that owner's
-- accounts, so account totals reconcile to net external cash movement.
WITH account_balances AS (
  SELECT
    a.user_id,
    COALESCE((SELECT sum(i.amount) FROM public.income_entries i WHERE i.account_id = a.id), 0)
      - COALESCE((SELECT sum(e.amount) FROM public.expense_entries e WHERE e.account_id = a.id), 0)
      + COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.to_account_id = a.id), 0)
      - COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.from_account_id = a.id), 0)
      - COALESCE((SELECT sum(r.original_amount) FROM public.recoverables r WHERE r.source_account_id = a.id), 0)
      + COALESCE((SELECT sum(p.amount) FROM public.recoverable_repayments p WHERE p.account_id = a.id), 0)
      AS calculated_balance
  FROM public.accounts a
), totals AS (
  SELECT
    a.user_id,
    COALESCE((SELECT sum(amount) FROM public.income_entries i WHERE i.user_id = a.user_id), 0) AS income,
    COALESCE((SELECT sum(amount) FROM public.expense_entries e WHERE e.user_id = a.user_id), 0) AS expenses,
    COALESCE((SELECT sum(original_amount) FROM public.recoverables r WHERE r.user_id = a.user_id), 0) AS advances,
    COALESCE((SELECT sum(amount) FROM public.recoverable_repayments p WHERE p.user_id = a.user_id), 0) AS recoveries,
    COALESCE((SELECT sum(amount) FROM public.transfers t WHERE t.user_id = a.user_id), 0) AS transfers_in,
    COALESCE((SELECT sum(amount) FROM public.transfers t WHERE t.user_id = a.user_id), 0) AS transfers_out,
    COALESCE((SELECT sum(calculated_balance) FROM account_balances b WHERE b.user_id = a.user_id), 0) AS calculated_total_account_balance
  FROM (SELECT DISTINCT user_id FROM public.accounts) a
)
SELECT
  user_id,
  income,
  expenses,
  advances,
  recoveries,
  transfers_in - transfers_out AS net_internal_transfers,
  income - expenses - advances + recoveries AS expected_total_account_balance,
  calculated_total_account_balance,
  calculated_total_account_balance - (income - expenses - advances + recoveries) AS reconciliation_difference
FROM totals;

ROLLBACK;
