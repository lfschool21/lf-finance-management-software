\set ON_ERROR_STOP on

SELECT 'carry_forward|' || carry_forward_fees
FROM public.academic_years
WHERE id = '21111111-1111-4111-8111-111111111111';

SELECT 'tuition_pending_current|' || (
  y.target_tuition_fees + y.carry_forward_fees
  - COALESCE(sum(i.amount) FILTER (
      WHERE i.type = 'tuition'
        AND NOT i.is_late_collection
        AND i.academic_year_id = y.id
    ), 0)
)
FROM public.academic_years y
LEFT JOIN public.income_entries i
  ON i.academic_year_id = y.id OR i.original_year_id = y.id
WHERE y.id = '22222222-2222-4222-8222-222222222222'
GROUP BY y.id;

SELECT 'tuition_pending_old|' || (
  y.target_tuition_fees + y.carry_forward_fees
  - COALESCE(sum(i.amount) FILTER (
      WHERE i.type = 'tuition'
        AND ((NOT i.is_late_collection AND i.academic_year_id = y.id)
          OR (i.is_late_collection AND i.original_year_id = y.id))
    ), 0)
)
FROM public.academic_years y
LEFT JOIN public.income_entries i
  ON i.academic_year_id = y.id OR i.original_year_id = y.id
WHERE y.id = '21111111-1111-4111-8111-111111111111'
GROUP BY y.id;

SELECT 'account|' || a.name || '|' || (
  a.starting_balance
  + COALESCE((SELECT sum(amount) FROM public.income_entries WHERE account_id = a.id), 0)
  - COALESCE((SELECT sum(amount) FROM public.expense_entries WHERE account_id = a.id), 0)
  + COALESCE((SELECT sum(amount) FROM public.transfers WHERE to_account_id = a.id), 0)
  - COALESCE((SELECT sum(amount) FROM public.transfers WHERE from_account_id = a.id), 0)
)
FROM public.accounts a
ORDER BY a.name;

SELECT 'money_checksum|' || md5(string_agg(row_text, E'\n' ORDER BY row_text))
FROM (
  SELECT 'year:' || row_to_json(t)::TEXT AS row_text FROM public.academic_years t
  UNION ALL SELECT 'account:' || row_to_json(t)::TEXT FROM public.accounts t
  UNION ALL SELECT 'income:' || row_to_json(t)::TEXT FROM public.income_entries t
  UNION ALL SELECT 'expense:' || row_to_json(t)::TEXT FROM public.expense_entries t
  UNION ALL SELECT 'transfer:' || row_to_json(t)::TEXT FROM public.transfers t
  UNION ALL SELECT 'recurring:' || row_to_json(t)::TEXT FROM public.recurring_templates t
) financial_rows;
