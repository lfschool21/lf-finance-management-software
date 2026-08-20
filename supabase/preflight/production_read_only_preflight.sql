-- Production finance migration preflight for 20260821000100.
-- This script is intentionally read-only. Run it from the Supabase SQL Editor
-- while authenticated as the correct production project owner.
-- Save every result grid before considering migration approval.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5min';
SET LOCAL lock_timeout = '5s';

-- 1. Target identity. Confirm current_database/current_user and independently
-- confirm the dashboard project ref before trusting any later result.
SELECT
  current_database() AS database_name,
  current_user AS database_role,
  current_setting('transaction_read_only') AS transaction_read_only,
  now() AS snapshot_started_at;

-- 2. Migration ledger. The expected pre-upgrade state contains the two 2026-03
-- migrations and none of the three 2026-08 migrations.
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 3. Schema capability check. carry_forward_fees may already exist in a legacy
-- production schema. Its presence or absence is not itself a blocker.
SELECT
  to_regclass('public.academic_years') IS NOT NULL AS academic_years_exists,
  to_regclass('public.accounts') IS NOT NULL AS accounts_exists,
  to_regclass('public.income_entries') IS NOT NULL AS income_entries_exists,
  to_regclass('public.expense_entries') IS NOT NULL AS expense_entries_exists,
  to_regclass('public.transfers') IS NOT NULL AS transfers_exists,
  to_regclass('public.recurring_templates') IS NOT NULL AS recurring_templates_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_years'
      AND column_name = 'carry_forward_fees'
  ) AS carry_forward_fees_exists;

-- 4. One-row blocker summary. Every blocker_count must be zero before approval.
WITH blocker_counts AS (
  SELECT 'invalid_academic_year' AS check_name, count(*)::bigint AS blocker_count
  FROM public.academic_years y
  WHERE y.start_date > y.end_date
     OR y.target_tuition_fees < 0
     OR COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0) < 0

  UNION ALL
  SELECT 'overlapping_academic_years', count(*)::bigint
  FROM public.academic_years a
  JOIN public.academic_years b
    ON a.user_id = b.user_id
   AND a.id < b.id
   AND daterange(a.start_date, a.end_date, '[]')
       && daterange(b.start_date, b.end_date, '[]')

  UNION ALL
  SELECT 'null_late_collection_state', count(*)::bigint
  FROM public.income_entries
  WHERE is_late_collection IS NULL

  UNION ALL
  SELECT 'invalid_income_reference_ownership_or_date', count(*)::bigint
  FROM public.income_entries i
  LEFT JOIN public.academic_years y ON y.id = i.academic_year_id
  LEFT JOIN public.accounts a ON a.id = i.account_id
  WHERE y.id IS NULL OR a.id IS NULL
     OR y.user_id <> i.user_id OR a.user_id <> i.user_id
     OR NOT (i.date BETWEEN y.start_date AND y.end_date)

  UNION ALL
  SELECT 'invalid_expense_reference_ownership_or_date', count(*)::bigint
  FROM public.expense_entries e
  LEFT JOIN public.academic_years y ON y.id = e.academic_year_id
  LEFT JOIN public.accounts a ON a.id = e.account_id
  LEFT JOIN public.recurring_templates r ON r.id = e.recurring_template_id
  WHERE y.id IS NULL OR a.id IS NULL
     OR y.user_id <> e.user_id OR a.user_id <> e.user_id
     OR NOT (e.date BETWEEN y.start_date AND y.end_date)
     OR (e.recurring_template_id IS NOT NULL
       AND (r.id IS NULL OR r.user_id <> e.user_id))

  UNION ALL
  SELECT 'invalid_transfer_ownership_or_category', count(*)::bigint
  FROM public.transfers t
  LEFT JOIN public.accounts source ON source.id = t.from_account_id
  LEFT JOIN public.accounts destination ON destination.id = t.to_account_id
  WHERE source.id IS NULL OR destination.id IS NULL
     OR source.user_id <> t.user_id OR destination.user_id <> t.user_id
     OR t.category <> CASE
       WHEN source.type = 'cash' AND destination.type <> 'cash' THEN 'cash_deposit'
       WHEN source.type <> 'cash' AND destination.type = 'cash' THEN 'cash_withdrawal'
       WHEN source.type = 'school_bank' AND destination.type = 'personal_bank' THEN 'school_to_personal'
       WHEN source.type = 'personal_bank' AND destination.type = 'school_bank' THEN 'personal_to_school'
       ELSE 'internal'
     END

  UNION ALL
  SELECT 'ambiguous_late_payment_state', count(*)::bigint
  FROM public.income_entries
  WHERE (type <> 'tuition' AND (is_late_collection OR original_year_id IS NOT NULL))
     OR (type = 'tuition' AND is_late_collection AND original_year_id IS NULL)
     OR (type = 'tuition' AND NOT is_late_collection AND original_year_id IS NOT NULL)

  UNION ALL
  SELECT 'invalid_late_payment_obligation_year', count(*)::bigint
  FROM public.income_entries i
  JOIN public.academic_years booking ON booking.id = i.academic_year_id
  JOIN public.academic_years original ON original.id = i.original_year_id
  WHERE i.is_late_collection
    AND (booking.user_id <> i.user_id
      OR original.user_id <> i.user_id
      OR original.end_date >= booking.start_date)

  UNION ALL
  SELECT 'self_transfer', count(*)::bigint
  FROM public.transfers
  WHERE from_account_id = to_account_id

  UNION ALL
  SELECT 'orphaned_recurring_expense', count(*)::bigint
  FROM public.expense_entries e
  LEFT JOIN public.recurring_templates r ON r.id = e.recurring_template_id
  WHERE e.recurring_template_id IS NOT NULL AND r.id IS NULL

  UNION ALL
  SELECT 'home_expense_using_school_account', count(*)::bigint
  FROM public.expense_entries e
  JOIN public.accounts a ON a.id = e.account_id
  WHERE e.expense_type = 'home' AND a.type = 'school_bank'

  UNION ALL
  SELECT 'overpaid_tuition_obligation', count(*)::bigint
  FROM (
    SELECT y.id
    FROM public.academic_years y
    LEFT JOIN public.income_entries i
      ON i.type = 'tuition'
     AND ((NOT i.is_late_collection AND i.academic_year_id = y.id)
       OR (i.is_late_collection AND i.original_year_id = y.id))
    GROUP BY y.id, y.target_tuition_fees,
      COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
    HAVING COALESCE(sum(i.amount), 0)
      > y.target_tuition_fees
        + COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
  ) overpaid
)
SELECT check_name, blocker_count, blocker_count = 0 AS passes
FROM blocker_counts
ORDER BY check_name;

-- 5. Blocking row details. These result grids identify exact rows; do not update
-- them during preflight.
SELECT
  'invalid_academic_year' AS check_name,
  y.id, y.user_id, y.label, y.start_date, y.end_date,
  y.target_tuition_fees,
  COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0) AS carry_forward_fees
FROM public.academic_years y
WHERE y.start_date > y.end_date
   OR y.target_tuition_fees < 0
   OR COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0) < 0
ORDER BY y.user_id, y.start_date, y.id;

SELECT
  'overlapping_academic_years' AS check_name,
  a.user_id,
  a.id AS first_year_id, a.label AS first_label,
  a.start_date AS first_start, a.end_date AS first_end,
  b.id AS second_year_id, b.label AS second_label,
  b.start_date AS second_start, b.end_date AS second_end
FROM public.academic_years a
JOIN public.academic_years b
  ON a.user_id = b.user_id
 AND a.id < b.id
 AND daterange(a.start_date, a.end_date, '[]')
     && daterange(b.start_date, b.end_date, '[]')
ORDER BY a.user_id, a.start_date, b.start_date;

SELECT
  'null_late_collection_state' AS check_name,
  id, user_id, academic_year_id, type, amount, date, account_id,
  is_late_collection, original_year_id
FROM public.income_entries
WHERE is_late_collection IS NULL
ORDER BY user_id, date, id;

SELECT
  'invalid_income_reference_ownership_or_date' AS check_name,
  i.id, i.user_id, i.academic_year_id, i.account_id, i.date,
  y.user_id AS year_user_id, y.start_date AS year_start, y.end_date AS year_end,
  a.user_id AS account_user_id
FROM public.income_entries i
LEFT JOIN public.academic_years y ON y.id = i.academic_year_id
LEFT JOIN public.accounts a ON a.id = i.account_id
WHERE y.id IS NULL OR a.id IS NULL
   OR y.user_id <> i.user_id OR a.user_id <> i.user_id
   OR NOT (i.date BETWEEN y.start_date AND y.end_date)
ORDER BY i.user_id, i.date, i.id;

SELECT
  'invalid_expense_reference_ownership_or_date' AS check_name,
  e.id, e.user_id, e.academic_year_id, e.account_id,
  e.recurring_template_id, e.date,
  y.user_id AS year_user_id, y.start_date AS year_start, y.end_date AS year_end,
  a.user_id AS account_user_id, r.user_id AS template_user_id
FROM public.expense_entries e
LEFT JOIN public.academic_years y ON y.id = e.academic_year_id
LEFT JOIN public.accounts a ON a.id = e.account_id
LEFT JOIN public.recurring_templates r ON r.id = e.recurring_template_id
WHERE y.id IS NULL OR a.id IS NULL
   OR y.user_id <> e.user_id OR a.user_id <> e.user_id
   OR NOT (e.date BETWEEN y.start_date AND y.end_date)
   OR (e.recurring_template_id IS NOT NULL
     AND (r.id IS NULL OR r.user_id <> e.user_id))
ORDER BY e.user_id, e.date, e.id;

WITH transfer_details AS (
  SELECT
    t.*,
    source.user_id AS source_user_id,
    source.type AS source_type,
    destination.user_id AS destination_user_id,
    destination.type AS destination_type,
    CASE
      WHEN source.type = 'cash' AND destination.type <> 'cash' THEN 'cash_deposit'
      WHEN source.type <> 'cash' AND destination.type = 'cash' THEN 'cash_withdrawal'
      WHEN source.type = 'school_bank' AND destination.type = 'personal_bank' THEN 'school_to_personal'
      WHEN source.type = 'personal_bank' AND destination.type = 'school_bank' THEN 'personal_to_school'
      ELSE 'internal'
    END AS expected_category
  FROM public.transfers t
  LEFT JOIN public.accounts source ON source.id = t.from_account_id
  LEFT JOIN public.accounts destination ON destination.id = t.to_account_id
)
SELECT
  'invalid_transfer_ownership_or_category' AS check_name,
  id, user_id, from_account_id, to_account_id, amount, date, category,
  source_user_id, destination_user_id, source_type, destination_type,
  expected_category
FROM transfer_details
WHERE source_user_id IS NULL OR destination_user_id IS NULL
   OR source_user_id <> user_id OR destination_user_id <> user_id
   OR category <> expected_category
ORDER BY user_id, date, id;

SELECT
  'ambiguous_late_payment_state' AS check_name,
  id, user_id, academic_year_id, type, amount, date,
  is_late_collection, original_year_id
FROM public.income_entries
WHERE (type <> 'tuition' AND (is_late_collection OR original_year_id IS NOT NULL))
   OR (type = 'tuition' AND is_late_collection AND original_year_id IS NULL)
   OR (type = 'tuition' AND NOT is_late_collection AND original_year_id IS NOT NULL)
ORDER BY user_id, date, id;

SELECT
  'invalid_late_payment_obligation_year' AS check_name,
  i.id, i.user_id, i.academic_year_id AS booking_year_id,
  booking.start_date AS booking_start, booking.end_date AS booking_end,
  i.original_year_id, original.start_date AS original_start,
  original.end_date AS original_end, i.amount, i.date
FROM public.income_entries i
JOIN public.academic_years booking ON booking.id = i.academic_year_id
JOIN public.academic_years original ON original.id = i.original_year_id
WHERE i.is_late_collection
  AND (booking.user_id <> i.user_id
    OR original.user_id <> i.user_id
    OR original.end_date >= booking.start_date)
ORDER BY i.user_id, i.date, i.id;

SELECT
  'self_transfer' AS check_name,
  id, user_id, from_account_id, to_account_id, amount, date, category
FROM public.transfers
WHERE from_account_id = to_account_id
ORDER BY user_id, date, id;

SELECT
  'orphaned_recurring_expense' AS check_name,
  e.id, e.user_id, e.recurring_template_id, e.amount, e.date
FROM public.expense_entries e
LEFT JOIN public.recurring_templates r ON r.id = e.recurring_template_id
WHERE e.recurring_template_id IS NOT NULL AND r.id IS NULL
ORDER BY e.user_id, e.date, e.id;

SELECT
  'home_expense_using_school_account' AS check_name,
  e.id, e.user_id, e.account_id, a.name AS account_name,
  e.amount, e.date, e.category, e.description
FROM public.expense_entries e
JOIN public.accounts a ON a.id = e.account_id
WHERE e.expense_type = 'home' AND a.type = 'school_bank'
ORDER BY e.user_id, e.date, e.id;

SELECT
  'overpaid_tuition_obligation' AS check_name,
  y.id AS academic_year_id, y.user_id, y.label,
  y.target_tuition_fees,
  COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0) AS carry_forward_fees,
  COALESCE(sum(i.amount), 0) AS tuition_collected,
  COALESCE(sum(i.amount), 0)
    - y.target_tuition_fees
    - COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
    AS overpaid_amount
FROM public.academic_years y
LEFT JOIN public.income_entries i
  ON i.type = 'tuition'
 AND ((NOT i.is_late_collection AND i.academic_year_id = y.id)
   OR (i.is_late_collection AND i.original_year_id = y.id))
GROUP BY y.id, y.user_id, y.label, y.target_tuition_fees,
  COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
HAVING COALESCE(sum(i.amount), 0)
  > y.target_tuition_fees
    + COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
ORDER BY y.user_id, y.start_date, y.id;

-- 6. Every non-zero carry-forward row. These are review-only and are preserved
-- exactly by migration 20260821000100; they are not blockers unless negative.
SELECT
  y.id, y.user_id, y.label, y.start_date, y.end_date,
  y.target_tuition_fees,
  COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
    AS carry_forward_fees,
  y.status, y.created_at, y.updated_at
FROM public.academic_years y
WHERE COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0) <> 0
ORDER BY y.user_id, y.start_date, y.id;

-- 7. Pre-migration snapshot: table counts.
SELECT 'academic_years' AS table_name, count(*)::bigint AS row_count FROM public.academic_years
UNION ALL SELECT 'accounts', count(*)::bigint FROM public.accounts
UNION ALL SELECT 'income_entries', count(*)::bigint FROM public.income_entries
UNION ALL SELECT 'expense_entries', count(*)::bigint FROM public.expense_entries
UNION ALL SELECT 'transfers', count(*)::bigint FROM public.transfers
UNION ALL SELECT 'recurring_templates', count(*)::bigint FROM public.recurring_templates
UNION ALL SELECT 'backups_log', count(*)::bigint FROM public.backups_log
ORDER BY table_name;

-- 8. Pre-migration snapshot: exact calculated account balances using the
-- pre-recoverables accounting model. Transfers net to zero across all accounts.
SELECT
  a.id AS account_id,
  a.user_id,
  a.name,
  a.type,
  a.is_archived,
  a.starting_balance AS opening_balance,
  COALESCE((SELECT sum(i.amount) FROM public.income_entries i WHERE i.account_id = a.id), 0)
    AS income_total,
  COALESCE((SELECT sum(e.amount) FROM public.expense_entries e WHERE e.account_id = a.id), 0)
    AS expense_total,
  COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.to_account_id = a.id), 0)
    AS transfers_in,
  COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.from_account_id = a.id), 0)
    AS transfers_out,
  a.starting_balance
    + COALESCE((SELECT sum(i.amount) FROM public.income_entries i WHERE i.account_id = a.id), 0)
    - COALESCE((SELECT sum(e.amount) FROM public.expense_entries e WHERE e.account_id = a.id), 0)
    + COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.to_account_id = a.id), 0)
    - COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.from_account_id = a.id), 0)
    AS calculated_current_balance
FROM public.accounts a
ORDER BY a.user_id, a.created_at, a.id;

-- 9. Pre-migration snapshot: tuition obligation and pending by academic year.
-- Null late-state rows are treated as direct payments here to match the current
-- application's null-coalescing behavior, but any such row still blocks migration.
SELECT
  y.id AS academic_year_id,
  y.user_id,
  y.label,
  y.start_date,
  y.end_date,
  y.status,
  y.target_tuition_fees,
  COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
    AS carry_forward_fees,
  y.target_tuition_fees
    + COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
    AS total_obligation,
  COALESCE(sum(i.amount) FILTER (
    WHERE i.type = 'tuition'
      AND (
        (NOT COALESCE(i.is_late_collection, FALSE) AND i.academic_year_id = y.id)
        OR (i.is_late_collection AND i.original_year_id = y.id)
      )
  ), 0) AS tuition_collected,
  y.target_tuition_fees
    + COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
    - COALESCE(sum(i.amount) FILTER (
      WHERE i.type = 'tuition'
        AND (
          (NOT COALESCE(i.is_late_collection, FALSE) AND i.academic_year_id = y.id)
          OR (i.is_late_collection AND i.original_year_id = y.id)
        )
    ), 0) AS tuition_pending
FROM public.academic_years y
LEFT JOIN public.income_entries i
  ON i.academic_year_id = y.id OR i.original_year_id = y.id
GROUP BY y.id, y.user_id, y.label, y.start_date, y.end_date, y.status,
  y.target_tuition_fees,
  COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
ORDER BY y.user_id, y.start_date, y.id;

-- 10. Stable table checksums. academic_years excludes carry_forward_fees from
-- its base checksum because the migration may add that column. Carry values have
-- their own normalized checksum immediately afterward.
WITH financial_rows AS (
  SELECT 'academic_years' AS table_name, id,
    to_jsonb(y) - 'carry_forward_fees' AS payload
  FROM public.academic_years y
  UNION ALL SELECT 'accounts', id, to_jsonb(a) FROM public.accounts a
  UNION ALL SELECT 'income_entries', id, to_jsonb(i) FROM public.income_entries i
  UNION ALL SELECT 'expense_entries', id, to_jsonb(e) FROM public.expense_entries e
  UNION ALL SELECT 'transfers', id, to_jsonb(t) FROM public.transfers t
  UNION ALL SELECT 'recurring_templates', id, to_jsonb(r) FROM public.recurring_templates r
  UNION ALL SELECT 'backups_log', id, to_jsonb(b) FROM public.backups_log b
)
SELECT
  table_name,
  count(*)::bigint AS row_count,
  md5(COALESCE(string_agg(id::text || ':' || payload::text, E'\n' ORDER BY id), ''))
    AS row_checksum
FROM financial_rows
GROUP BY table_name
ORDER BY table_name;

SELECT
  count(*)::bigint AS academic_year_count,
  md5(COALESCE(string_agg(
    y.id::text || ':'
      || COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)::text,
    E'\n' ORDER BY y.id
  ), '')) AS carry_forward_checksum
FROM public.academic_years y;

-- No data or schema changes are retained. READ ONLY already enforces this;
-- ROLLBACK also makes the intended lifecycle explicit.
ROLLBACK;
