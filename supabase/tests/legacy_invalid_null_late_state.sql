\set ON_ERROR_STOP on
UPDATE public.income_entries
SET is_late_collection = NULL
WHERE id = '51111111-1111-4111-8111-111111111111';
