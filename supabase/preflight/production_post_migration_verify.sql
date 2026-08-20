-- Read-only verification after the three 20260821 migrations have been applied.
-- Also rerun production_read_only_preflight.sql and compare its saved snapshot
-- outputs with the pre-migration copies.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5min';
SET LOCAL lock_timeout = '5s';

SELECT
  current_database() AS database_name,
  current_user AS database_role,
  current_setting('transaction_read_only') AS transaction_read_only,
  now() AS verification_started_at;

SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- All rows must report exists = true.
SELECT object_name, exists
FROM (
  VALUES
    ('table:recoverables', to_regclass('public.recoverables') IS NOT NULL),
    ('table:recoverable_repayments', to_regclass('public.recoverable_repayments') IS NOT NULL),
    ('function:complete_initial_setup', to_regprocedure('public.complete_initial_setup(jsonb,jsonb,jsonb)') IS NOT NULL),
    ('function:wipe_finance_data', to_regprocedure('public.wipe_finance_data()') IS NOT NULL),
    ('function:restore_finance_backup', to_regprocedure('public.restore_finance_backup(jsonb)') IS NOT NULL),
    ('function:save_transfer', to_regprocedure('public.save_transfer(uuid,uuid,uuid,numeric,date,text,text)') IS NOT NULL),
    ('function:record_recurring_expense', to_regprocedure('public.record_recurring_expense(uuid,numeric,date,uuid,uuid,text)') IS NOT NULL),
    ('function:set_account_current_balance', to_regprocedure('public.set_account_current_balance(uuid,text,text,numeric)') IS NOT NULL)
) AS expected_objects(object_name, exists)
ORDER BY object_name;

-- Expected integrity constraints.
SELECT expected.constraint_name,
  c.oid IS NOT NULL AS exists,
  CASE WHEN c.oid IS NOT NULL THEN pg_get_constraintdef(c.oid) END AS definition
FROM (VALUES
  ('academic_years_dates_check'),
  ('academic_years_target_nonnegative_check'),
  ('academic_years_carry_nonnegative_check'),
  ('income_entries_type_check'),
  ('income_entries_late_state_check'),
  ('transfers_distinct_accounts_check'),
  ('expense_entries_recurring_template_id_fkey')
) AS expected(constraint_name)
LEFT JOIN pg_constraint c ON c.conname = expected.constraint_name
ORDER BY expected.constraint_name;

-- Expected finance triggers.
SELECT expected.trigger_name, t.oid IS NOT NULL AS exists
FROM (VALUES
  ('validate_academic_year_overlap_trigger'),
  ('validate_academic_year_financial_update_trigger'),
  ('validate_income_integrity_trigger'),
  ('validate_expense_integrity_trigger'),
  ('validate_account_type_history_trigger'),
  ('validate_transfer_ownership_trigger'),
  ('validate_recoverable_integrity_trigger'),
  ('validate_recoverable_repayment_trigger')
) AS expected(trigger_name)
LEFT JOIN pg_trigger t
  ON t.tgname = expected.trigger_name AND NOT t.tgisinternal
ORDER BY expected.trigger_name;

-- RLS must be enabled for every user-owned table.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'academic_years', 'accounts', 'income_entries', 'expense_entries',
    'transfers', 'recurring_templates', 'backups_log', 'recoverables',
    'recoverable_repayments'
  )
ORDER BY c.relname;

-- Transfer writes must be RPC-only: SELECT and DELETE policies should exist,
-- and no INSERT or UPDATE policy should exist.
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'transfers'
ORDER BY policyname;

-- Recoverables policies must exist for authenticated per-user RLS.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('recoverables', 'recoverable_repayments')
ORDER BY tablename, policyname;

-- is_late_collection must be non-null after migration 00100.
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'income_entries' AND column_name = 'is_late_collection')
    OR (table_name = 'academic_years' AND column_name = 'carry_forward_fees')
  )
ORDER BY table_name, column_name;

-- With application writes frozen during migration, both new tables should be
-- empty immediately after deployment. If not empty, investigate who wrote rows.
SELECT 'recoverables' AS table_name, count(*)::bigint AS row_count
FROM public.recoverables
UNION ALL
SELECT 'recoverable_repayments', count(*)::bigint
FROM public.recoverable_repayments
ORDER BY table_name;

ROLLBACK;
