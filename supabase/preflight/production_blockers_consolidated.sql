-- Consolidated, strictly read-only production blocker preflight for migration
-- 20260821000100_finance_integrity_reconciliation.sql.
--
-- Supabase SQL Editor displays the final result grid. This script therefore has
-- one result-producing SELECT containing every blocker plus a review-only
-- summary of non-zero carry_forward_fees rows.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5min';
SET LOCAL lock_timeout = '5s';

WITH blocker_checks AS (
  SELECT
    'invalid_academic_year'::text AS check_name,
    count(*)::bigint AS blocker_count,
    jsonb_agg(jsonb_build_object(
      'id', y.id,
      'user_id', y.user_id,
      'label', y.label,
      'start_date', y.start_date,
      'end_date', y.end_date,
      'target_tuition_fees', y.target_tuition_fees,
      'carry_forward_fees',
        COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
    ) ORDER BY y.user_id, y.start_date, y.id)
      FILTER (WHERE y.id IS NOT NULL) AS details
  FROM public.academic_years y
  WHERE y.start_date > y.end_date
     OR y.target_tuition_fees < 0
     OR COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0) < 0

  UNION ALL
  SELECT
    'overlapping_academic_years',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'user_id', a.user_id,
      'first_year_id', a.id,
      'first_label', a.label,
      'first_start', a.start_date,
      'first_end', a.end_date,
      'second_year_id', b.id,
      'second_label', b.label,
      'second_start', b.start_date,
      'second_end', b.end_date
    ) ORDER BY a.user_id, a.start_date, b.start_date)
      FILTER (WHERE a.id IS NOT NULL)
  FROM public.academic_years a
  JOIN public.academic_years b
    ON a.user_id = b.user_id
   AND a.id < b.id
   AND daterange(a.start_date, a.end_date, '[]')
       && daterange(b.start_date, b.end_date, '[]')

  UNION ALL
  SELECT
    'null_late_collection_state',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', i.id,
      'user_id', i.user_id,
      'academic_year_id', i.academic_year_id,
      'type', i.type,
      'amount', i.amount,
      'date', i.date,
      'account_id', i.account_id,
      'original_year_id', i.original_year_id
    ) ORDER BY i.user_id, i.date, i.id)
      FILTER (WHERE i.id IS NOT NULL)
  FROM public.income_entries i
  WHERE i.is_late_collection IS NULL

  UNION ALL
  SELECT
    'invalid_income_reference_ownership_or_date',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', i.id,
      'user_id', i.user_id,
      'academic_year_id', i.academic_year_id,
      'account_id', i.account_id,
      'date', i.date,
      'year_user_id', y.user_id,
      'year_start', y.start_date,
      'year_end', y.end_date,
      'account_user_id', a.user_id
    ) ORDER BY i.user_id, i.date, i.id)
      FILTER (WHERE i.id IS NOT NULL)
  FROM public.income_entries i
  LEFT JOIN public.academic_years y ON y.id = i.academic_year_id
  LEFT JOIN public.accounts a ON a.id = i.account_id
  WHERE y.id IS NULL OR a.id IS NULL
     OR y.user_id <> i.user_id OR a.user_id <> i.user_id
     OR NOT (i.date BETWEEN y.start_date AND y.end_date)

  UNION ALL
  SELECT
    'invalid_expense_reference_ownership_or_date',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', e.id,
      'user_id', e.user_id,
      'academic_year_id', e.academic_year_id,
      'account_id', e.account_id,
      'recurring_template_id', e.recurring_template_id,
      'date', e.date,
      'year_user_id', y.user_id,
      'year_start', y.start_date,
      'year_end', y.end_date,
      'account_user_id', a.user_id,
      'template_user_id', r.user_id
    ) ORDER BY e.user_id, e.date, e.id)
      FILTER (WHERE e.id IS NOT NULL)
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
  SELECT
    'invalid_transfer_ownership_or_category',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', t.id,
      'user_id', t.user_id,
      'from_account_id', t.from_account_id,
      'to_account_id', t.to_account_id,
      'amount', t.amount,
      'date', t.date,
      'actual_category', t.category,
      'expected_category', CASE
        WHEN source.type = 'cash' AND destination.type <> 'cash' THEN 'cash_deposit'
        WHEN source.type <> 'cash' AND destination.type = 'cash' THEN 'cash_withdrawal'
        WHEN source.type = 'school_bank' AND destination.type = 'personal_bank' THEN 'school_to_personal'
        WHEN source.type = 'personal_bank' AND destination.type = 'school_bank' THEN 'personal_to_school'
        ELSE 'internal'
      END,
      'source_user_id', source.user_id,
      'destination_user_id', destination.user_id
    ) ORDER BY t.user_id, t.date, t.id)
      FILTER (WHERE t.id IS NOT NULL)
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
  SELECT
    'ambiguous_late_payment_state',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', i.id,
      'user_id', i.user_id,
      'academic_year_id', i.academic_year_id,
      'type', i.type,
      'amount', i.amount,
      'date', i.date,
      'is_late_collection', i.is_late_collection,
      'original_year_id', i.original_year_id
    ) ORDER BY i.user_id, i.date, i.id)
      FILTER (WHERE i.id IS NOT NULL)
  FROM public.income_entries i
  WHERE (i.type <> 'tuition' AND (i.is_late_collection OR i.original_year_id IS NOT NULL))
     OR (i.type = 'tuition' AND i.is_late_collection AND i.original_year_id IS NULL)
     OR (i.type = 'tuition' AND NOT i.is_late_collection AND i.original_year_id IS NOT NULL)

  UNION ALL
  SELECT
    'invalid_late_payment_obligation_year',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', i.id,
      'user_id', i.user_id,
      'booking_year_id', i.academic_year_id,
      'booking_start', booking.start_date,
      'booking_end', booking.end_date,
      'original_year_id', i.original_year_id,
      'original_start', original.start_date,
      'original_end', original.end_date,
      'amount', i.amount,
      'date', i.date
    ) ORDER BY i.user_id, i.date, i.id)
      FILTER (WHERE i.id IS NOT NULL)
  FROM public.income_entries i
  JOIN public.academic_years booking ON booking.id = i.academic_year_id
  JOIN public.academic_years original ON original.id = i.original_year_id
  WHERE i.is_late_collection
    AND (booking.user_id <> i.user_id
      OR original.user_id <> i.user_id
      OR original.end_date >= booking.start_date)

  UNION ALL
  SELECT
    'self_transfer',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', t.id,
      'user_id', t.user_id,
      'account_id', t.from_account_id,
      'amount', t.amount,
      'date', t.date,
      'category', t.category
    ) ORDER BY t.user_id, t.date, t.id)
      FILTER (WHERE t.id IS NOT NULL)
  FROM public.transfers t
  WHERE t.from_account_id = t.to_account_id

  UNION ALL
  SELECT
    'orphaned_recurring_expense',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', e.id,
      'user_id', e.user_id,
      'recurring_template_id', e.recurring_template_id,
      'amount', e.amount,
      'date', e.date
    ) ORDER BY e.user_id, e.date, e.id)
      FILTER (WHERE e.id IS NOT NULL)
  FROM public.expense_entries e
  LEFT JOIN public.recurring_templates r ON r.id = e.recurring_template_id
  WHERE e.recurring_template_id IS NOT NULL AND r.id IS NULL

  UNION ALL
  SELECT
    'home_expense_using_school_account',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', e.id,
      'user_id', e.user_id,
      'account_id', e.account_id,
      'account_name', a.name,
      'amount', e.amount,
      'date', e.date,
      'category', e.category,
      'description', e.description
    ) ORDER BY e.user_id, e.date, e.id)
      FILTER (WHERE e.id IS NOT NULL)
  FROM public.expense_entries e
  JOIN public.accounts a ON a.id = e.account_id
  WHERE e.expense_type = 'home' AND a.type = 'school_bank'

  UNION ALL
  SELECT
    'overpaid_tuition_obligation',
    count(*)::bigint,
    jsonb_agg(jsonb_build_object(
      'academic_year_id', overpaid.id,
      'user_id', overpaid.user_id,
      'label', overpaid.label,
      'target_tuition_fees', overpaid.target_tuition_fees,
      'carry_forward_fees', overpaid.carry_forward_fees,
      'tuition_collected', overpaid.tuition_collected,
      'overpaid_amount', overpaid.overpaid_amount
    ) ORDER BY overpaid.user_id, overpaid.start_date, overpaid.id)
      FILTER (WHERE overpaid.id IS NOT NULL)
  FROM (
    SELECT
      y.id, y.user_id, y.label, y.start_date, y.target_tuition_fees,
      COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
        AS carry_forward_fees,
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
    GROUP BY y.id, y.user_id, y.label, y.start_date, y.target_tuition_fees,
      COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
    HAVING COALESCE(sum(i.amount), 0)
      > y.target_tuition_fees
        + COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0)
  ) overpaid
),
carry_forward_review AS (
  SELECT
    count(*)::bigint AS review_count,
    jsonb_agg(jsonb_build_object(
      'id', y.id,
      'user_id', y.user_id,
      'label', y.label,
      'start_date', y.start_date,
      'end_date', y.end_date,
      'target_tuition_fees', y.target_tuition_fees,
      'carry_forward_fees',
        COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0),
      'status', y.status,
      'created_at', y.created_at,
      'updated_at', y.updated_at
    ) ORDER BY y.user_id, y.start_date, y.id)
      FILTER (WHERE y.id IS NOT NULL) AS details
  FROM public.academic_years y
  WHERE COALESCE(NULLIF(to_jsonb(y)->>'carry_forward_fees', '')::numeric, 0) <> 0
),
all_results AS (
  SELECT
    check_name,
    blocker_count,
    CASE WHEN blocker_count = 0 THEN 'PASS' ELSE 'BLOCKED' END::text AS status,
    COALESCE(details, '[]'::jsonb) AS details,
    1 AS sort_group
  FROM blocker_checks

  UNION ALL
  SELECT
    'nonzero_carry_forward_fees_review_only',
    review_count,
    CASE WHEN review_count = 0 THEN 'NONE' ELSE 'REVIEW_ONLY' END,
    COALESCE(details, '[]'::jsonb),
    2
  FROM carry_forward_review
)
SELECT check_name, blocker_count, status, details
FROM all_results
ORDER BY sort_group, check_name;

ROLLBACK;
