\set ON_ERROR_STOP on
INSERT INTO public.transfers (
  id, user_id, from_account_id, to_account_id, amount, date, category, notes
) VALUES (
  '72222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  '33333333-3333-4333-8333-333333333333',
  1000, '2025-08-11', 'internal', 'Ambiguous legacy self-transfer'
);
