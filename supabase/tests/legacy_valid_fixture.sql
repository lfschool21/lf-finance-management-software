\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'legacy-owner@local.test',
  crypt('LocalRelease123!', gen_salt('bf')), NOW(),
  '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB, NOW(), NOW()
);

-- Some deployed databases already contain this application-known legacy column.
-- Migration 20260821000100 must preserve its value rather than reinterpret it.
ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS carry_forward_fees NUMERIC NOT NULL DEFAULT 0;

INSERT INTO public.academic_years (
  id, user_id, label, start_date, end_date, target_tuition_fees,
  carry_forward_fees, status, created_at, updated_at
) VALUES
  (
    '21111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '2024-25', '2024-06-05', '2025-06-04', 80000, 12500, 'closed',
    '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    '2025-26', '2025-06-05', '2026-06-04', 100000, 0, 'active',
    '2025-06-05T00:00:00Z', '2025-06-05T00:00:00Z'
  );

INSERT INTO public.accounts (
  id, user_id, name, type, starting_balance, is_archived, created_at, updated_at
) VALUES
  ('31111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Legacy School', 'school_bank', 100000, FALSE, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'),
  ('32222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Legacy Personal', 'personal_bank', 50000, FALSE, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Legacy Cash', 'cash', 10000, FALSE, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z');

INSERT INTO public.recurring_templates (
  id, user_id, expense_type, category, default_amount, recurrence_interval,
  last_generated_date, is_active, created_at, updated_at
) VALUES (
  '41111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'school', 'Utilities', 2000, 'monthly', '2025-09-15', TRUE,
  '2025-06-05T00:00:00Z', '2025-09-15T00:00:00Z'
);

INSERT INTO public.income_entries (
  id, user_id, academic_year_id, type, amount, date, account_id,
  is_late_collection, original_year_id, notes, tags, created_at, updated_at
) VALUES
  ('51111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', 'tuition', 20000, '2024-09-01', '31111111-1111-4111-8111-111111111111', FALSE, NULL, 'Old-year direct tuition', ARRAY['legacy'], '2024-09-01T00:00:00Z', '2024-09-01T00:00:00Z'),
  ('52222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'tuition', 30000, '2025-08-01', '31111111-1111-4111-8111-111111111111', FALSE, NULL, 'Current tuition', ARRAY['legacy'], '2025-08-01T00:00:00Z', '2025-08-01T00:00:00Z'),
  ('53333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'lunch', 5000, '2025-08-02', '31111111-1111-4111-8111-111111111111', FALSE, NULL, 'Lunch income', ARRAY['legacy'], '2025-08-02T00:00:00Z', '2025-08-02T00:00:00Z'),
  ('54444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'tuition', 10000, '2025-08-03', '31111111-1111-4111-8111-111111111111', TRUE, '21111111-1111-4111-8111-111111111111', 'Late old fees', ARRAY['legacy'], '2025-08-03T00:00:00Z', '2025-08-03T00:00:00Z');

INSERT INTO public.expense_entries (
  id, user_id, academic_year_id, expense_type, category, sub_category, amount,
  date, account_id, description, tags, is_recurring_instance,
  recurring_template_id, created_at, updated_at
) VALUES
  ('61111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'school', 'Salary', NULL, 10000, '2025-08-05', '31111111-1111-4111-8111-111111111111', 'School salary', ARRAY['legacy'], FALSE, NULL, '2025-08-05T00:00:00Z', '2025-08-05T00:00:00Z'),
  ('62222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'home', 'Household', NULL, 5000, '2025-08-06', '32222222-2222-4222-8222-222222222222', 'Home expense', ARRAY['legacy'], FALSE, NULL, '2025-08-06T00:00:00Z', '2025-08-06T00:00:00Z'),
  ('63333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'school', 'Utilities', NULL, 2000, '2025-09-15', '31111111-1111-4111-8111-111111111111', 'Recurring electricity', ARRAY['legacy'], TRUE, '41111111-1111-4111-8111-111111111111', '2025-09-15T00:00:00Z', '2025-09-15T00:00:00Z');

INSERT INTO public.transfers (
  id, user_id, from_account_id, to_account_id, amount, date, category,
  notes, created_at, updated_at
) VALUES (
  '71111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '31111111-1111-4111-8111-111111111111',
  '32222222-2222-4222-8222-222222222222',
  15000, '2025-08-10', 'school_to_personal', 'Legacy transfer',
  '2025-08-10T00:00:00Z', '2025-08-10T00:00:00Z'
);

COMMIT;
