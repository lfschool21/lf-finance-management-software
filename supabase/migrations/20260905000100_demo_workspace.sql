-- Demo workspace creation, seeding, reset, and discard routines.
-- Enforces that caller must have a valid auth.uid() and an anonymous Supabase JWT claim.

CREATE OR REPLACE FUNCTION public.discard_demo_workspace()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  is_anon BOOLEAN := COALESCE((auth.jwt()->>'is_anonymous')::boolean, false);
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT is_anon THEN
    RAISE EXCEPTION 'Demo workspace functions can only be invoked by anonymous demo sessions';
  END IF;

  DELETE FROM public.recoverable_repayments WHERE user_id = caller_id;
  DELETE FROM public.recoverables WHERE user_id = caller_id;
  DELETE FROM public.transfers WHERE user_id = caller_id;
  DELETE FROM public.expense_entries WHERE user_id = caller_id;
  DELETE FROM public.income_entries WHERE user_id = caller_id;
  DELETE FROM public.student_enrollments WHERE user_id = caller_id;
  DELETE FROM public.students WHERE user_id = caller_id;
  DELETE FROM public.recurring_templates WHERE user_id = caller_id;
  DELETE FROM public.backups_log WHERE user_id = caller_id;
  DELETE FROM public.accounts WHERE user_id = caller_id;
  DELETE FROM public.academic_years WHERE user_id = caller_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.populate_demo_workspace()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  is_anon BOOLEAN := COALESCE((auth.jwt()->>'is_anonymous')::boolean, false);

  curr_start_year INT;
  prev_start_year INT;
  curr_ay_label TEXT;
  prev_ay_label TEXT;
  curr_start_date DATE;
  curr_end_date DATE;
  prev_start_date DATE;
  prev_end_date DATE;

  d1 DATE;
  d2 DATE;
  d3 DATE;
  d4 DATE;
  d5 DATE;
  d6 DATE;
  d7 DATE;

  curr_year_id UUID := gen_random_uuid();
  prev_year_id UUID := gen_random_uuid();

  acc_school_id UUID := gen_random_uuid();
  acc_personal_id UUID := gen_random_uuid();
  acc_cash_id UUID := gen_random_uuid();
  acc_archived_id UUID := gen_random_uuid();

  tmpl_salary_id UUID := gen_random_uuid();
  tmpl_rent_id UUID := gen_random_uuid();
  tmpl_electricity_id UUID := gen_random_uuid();
  tmpl_internet_id UUID := gen_random_uuid();

  s_aarav UUID := gen_random_uuid();
  s_diya UUID := gen_random_uuid();
  s_rohan UUID := gen_random_uuid();
  s_ananya UUID := gen_random_uuid();
  s_kabir UUID := gen_random_uuid();
  s_meera UUID := gen_random_uuid();
  s_vihaan UUID := gen_random_uuid();
  s_riya UUID := gen_random_uuid();
  s_devansh UUID := gen_random_uuid();
  s_ishaan UUID := gen_random_uuid();
  s_kavyanjali UUID := gen_random_uuid();
  s_aryan UUID := gen_random_uuid();
  s_tanvi UUID := gen_random_uuid();
  s_pranav UUID := gen_random_uuid();

  e_aarav UUID := gen_random_uuid();
  e_diya UUID := gen_random_uuid();
  e_rohan UUID := gen_random_uuid();
  e_ananya UUID := gen_random_uuid();
  e_ananya_prev UUID := gen_random_uuid();
  e_kabir UUID := gen_random_uuid();
  e_kabir_prev UUID := gen_random_uuid();
  e_meera UUID := gen_random_uuid();
  e_vihaan UUID := gen_random_uuid();
  e_riya UUID := gen_random_uuid();
  e_devansh UUID := gen_random_uuid();
  e_ishaan UUID := gen_random_uuid();
  e_kavyanjali UUID := gen_random_uuid();
  e_aryan UUID := gen_random_uuid();
  e_tanvi UUID := gen_random_uuid();
  e_pranav UUID := gen_random_uuid();

  rec_contractor_id UUID := gen_random_uuid();
  rec_staff_id UUID := gen_random_uuid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT is_anon THEN
    RAISE EXCEPTION 'Demo workspace functions can only be invoked by anonymous demo sessions';
  END IF;

  -- 1. Determine dynamic academic years based on June 5 rule relative to CURRENT_DATE
  IF EXTRACT(MONTH FROM CURRENT_DATE) < 6 OR (EXTRACT(MONTH FROM CURRENT_DATE) = 6 AND EXTRACT(DAY FROM CURRENT_DATE) < 5) THEN
    curr_start_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT - 1;
  ELSE
    curr_start_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  END IF;
  prev_start_year := curr_start_year - 1;

  curr_ay_label := curr_start_year::TEXT || '-' || lpad(((curr_start_year + 1) % 100)::TEXT, 2, '0');
  prev_ay_label := prev_start_year::TEXT || '-' || lpad(((prev_start_year + 1) % 100)::TEXT, 2, '0');

  curr_start_date := make_date(curr_start_year, 6, 5);
  curr_end_date   := make_date(curr_start_year + 1, 6, 4);
  prev_start_date := make_date(prev_start_year, 6, 5);
  prev_end_date   := make_date(prev_start_year + 1, 6, 4);

  d1 := curr_start_date + INTERVAL '10 days';
  d2 := curr_start_date + INTERVAL '20 days';
  d3 := curr_start_date + INTERVAL '35 days';
  d4 := curr_start_date + INTERVAL '45 days';
  d5 := curr_start_date + INTERVAL '55 days';
  d6 := curr_start_date + INTERVAL '68 days';
  d7 := curr_start_date + INTERVAL '80 days';

  -- 2. Insert Academic Years
  INSERT INTO public.academic_years (
    id, user_id, label, start_date, end_date, target_tuition_fees, carry_forward_fees, status
  ) VALUES
  (prev_year_id, caller_id, prev_ay_label, prev_start_date, prev_end_date, 1000000, 0, 'pending_collections'),
  (curr_year_id, caller_id, curr_ay_label, curr_start_date, curr_end_date, 1200000, 0, 'active');

  -- 3. Insert Accounts
  INSERT INTO public.accounts (
    id, user_id, name, type, starting_balance, is_archived
  ) VALUES
  (acc_school_id, caller_id, 'School Bank Account', 'school_bank', 350000, FALSE),
  (acc_personal_id, caller_id, 'Personal Bank Account', 'personal_bank', 120000, FALSE),
  (acc_cash_id, caller_id, 'Cash at Home', 'cash', 45000, FALSE),
  (acc_archived_id, caller_id, 'Closed Petty Account', 'personal_bank', 0, TRUE);

  -- 4. Insert Recurring Templates
  INSERT INTO public.recurring_templates (
    id, user_id, expense_type, category, default_amount, recurrence_interval, last_generated_date, is_active
  ) VALUES
  (tmpl_salary_id, caller_id, 'school', 'Salary & Wages', 85000, 'monthly', (CURRENT_DATE - INTERVAL '1 month')::DATE, TRUE),
  (tmpl_rent_id, caller_id, 'school', 'Land Rent', 25000, 'monthly', (CURRENT_DATE - INTERVAL '1 month')::DATE, TRUE),
  (tmpl_electricity_id, caller_id, 'school', 'Electricity Bill', 7000, 'monthly', (CURRENT_DATE - INTERVAL '2 months')::DATE, TRUE),
  (tmpl_internet_id, caller_id, 'school', 'Internet & Phone Bill', 2400, 'bimonthly', (CURRENT_DATE - INTERVAL '2 months')::DATE, TRUE);

  -- 5. Insert Students
  INSERT INTO public.students (
    id, user_id, admission_number, full_name, status, notes
  ) VALUES
  (s_aarav, caller_id, 'DEMO-101', 'Aarav Patel', 'active', 'Prefers digital payment receipts via WhatsApp'),
  (s_diya, caller_id, 'DEMO-102', 'Diya Sharma', 'active', 'Gujarati medium scholarship consideration'),
  (s_rohan, caller_id, 'DEMO-103', 'Rohan Mehta', 'active', 'Father pays cash quarterly at office'),
  (s_ananya, caller_id, 'DEMO-104', 'Ananya Joshi', 'active', 'Enrolled since pre-primary'),
  (s_kabir, caller_id, 'DEMO-105', 'Kabir Shah', 'active', 'Transferred from suburban branch'),
  (s_meera, caller_id, 'DEMO-106', 'Meera Dave', 'active', 'Parent direct bank transfer payer'),
  (s_vihaan, caller_id, 'DEMO-107', 'Vihaan Trivedi', 'active', 'Class 1 newly admitted'),
  (s_riya, caller_id, 'DEMO-108', 'Riya Patel', 'active', 'High academic achiever in Class 9'),
  (s_devansh, caller_id, 'DEMO-109', 'Devansh Desai', 'active', 'Sibling discount registered'),
  (s_ishaan, caller_id, 'DEMO-110', 'Ishaan Parekh', 'active', 'Class 10 board exam candidate'),
  (s_kavyanjali, caller_id, 'DEMO-111', 'Kavyanjali Bhatt', 'active', 'Active cultural activities participant'),
  (s_aryan, caller_id, 'DEMO-112', 'Aryan Vora', 'active', 'Full term payment settled early'),
  (s_tanvi, caller_id, 'DEMO-113', 'Tanvi Rao', 'active', 'Gujarati medium section leader'),
  (s_pranav, caller_id, 'DEMO-114', 'Pranav Solanki', 'active', 'Sports team representative');

  -- 6. Insert Student Enrollments
  INSERT INTO public.student_enrollments (
    id, user_id, student_id, academic_year_id, class_name, medium,
    annual_fee_amount, additional_outstanding_amount,
    opening_collected_cash, opening_collected_upi, opening_collected_other,
    opening_snapshot_date, status
  ) VALUES
  (e_aarav, caller_id, s_aarav, curr_year_id, 'Class 5', 'english', 45000, 0, 15000, 0, 0, curr_start_date, 'active'),
  (e_diya, caller_id, s_diya, curr_year_id, 'Class 6', 'gujarati', 40000, 0, 0, 10000, 0, curr_start_date, 'active'),
  (e_rohan, caller_id, s_rohan, curr_year_id, 'Class 4', 'english', 35000, 0, 5000, 0, 0, curr_start_date, 'active'),
  (e_ananya, caller_id, s_ananya, curr_year_id, 'Class 3', 'english', 30000, 0, 0, 0, 0, curr_start_date, 'active'),
  (e_ananya_prev, caller_id, s_ananya, prev_year_id, 'Class 2', 'english', 25000, 0, 10000, 0, 0, prev_start_date, 'active'),
  (e_kabir, caller_id, s_kabir, curr_year_id, 'Class 7', 'english', 50000, 0, 10000, 0, 0, curr_start_date, 'active'),
  (e_kabir_prev, caller_id, s_kabir, prev_year_id, 'Class 6', 'english', 40000, 0, 20000, 0, 0, prev_start_date, 'active'),
  (e_meera, caller_id, s_meera, curr_year_id, 'Class 8', 'gujarati', 42000, 0, 0, 0, 0, curr_start_date, 'active'),
  (e_vihaan, caller_id, s_vihaan, curr_year_id, 'Class 1', 'english', 28000, 0, 14000, 14000, 0, curr_start_date, 'active'),
  (e_riya, caller_id, s_riya, curr_year_id, 'Class 9', 'english', 55000, 0, 0, 15000, 0, curr_start_date, 'active'),
  (e_devansh, caller_id, s_devansh, curr_year_id, 'Class 2', 'gujarati', 30000, 0, 5000, 0, 0, curr_start_date, 'active'),
  (e_ishaan, caller_id, s_ishaan, curr_year_id, 'Class 10', 'english', 60000, 0, 0, 0, 0, curr_start_date, 'active'),
  (e_kavyanjali, caller_id, s_kavyanjali, curr_year_id, 'Class 5', 'gujarati', 38000, 0, 0, 18000, 0, curr_start_date, 'active'),
  (e_aryan, caller_id, s_aryan, curr_year_id, 'Class 6', 'english', 42000, 0, 20000, 22000, 0, curr_start_date, 'active'),
  (e_tanvi, caller_id, s_tanvi, curr_year_id, 'Class 7', 'gujarati', 45000, 0, 0, 0, 0, curr_start_date, 'active'),
  (e_pranav, caller_id, s_pranav, curr_year_id, 'Class 8', 'english', 48000, 0, 20000, 0, 0, curr_start_date, 'active');

  -- 7. Insert Income Entries
  -- Current Tuition (School Bank UPI & Bank Transfer, Cash)
  INSERT INTO public.income_entries (
    user_id, academic_year_id, type, amount, date, account_id,
    is_late_collection, original_year_id, student_enrollment_id,
    payment_method, payment_reference, notes, tags
  ) VALUES
  (caller_id, curr_year_id, 'tuition', 15000, d1, acc_school_id, FALSE, NULL, e_aarav, 'upi', 'UPI-DEMO-AARAV1', 'Aarav Patel Term 1 installment', ARRAY['tuition', 'term1']),
  (caller_id, curr_year_id, 'tuition', 15000, d6, acc_school_id, FALSE, NULL, e_aarav, 'bank_transfer', 'NEFT-DEMO-AARAV2', 'Aarav Patel Term 2 settlement', ARRAY['tuition', 'term2']),
  (caller_id, curr_year_id, 'tuition', 15000, d3, acc_school_id, FALSE, NULL, e_diya, 'upi', 'UPI-DEMO-DIYA', 'Diya Sharma mid-term tuition payment', ARRAY['tuition']),
  (caller_id, curr_year_id, 'tuition', 10000, d3, acc_cash_id, FALSE, NULL, e_rohan, 'cash', 'CASH-REC-103', 'Rohan Mehta counter cash receipt', ARRAY['tuition', 'cash']),
  (caller_id, curr_year_id, 'tuition', 20000, d6, acc_school_id, FALSE, NULL, e_meera, 'bank_transfer', 'NEFT-DEMO-MEERA', 'Meera Dave parent RTGS payment', ARRAY['tuition']),
  (caller_id, curr_year_id, 'tuition', 18000, d2, acc_school_id, FALSE, NULL, e_riya, 'upi', 'UPI-DEMO-RIYA', 'Riya Patel Class 9 first term fee', ARRAY['tuition']),
  (caller_id, curr_year_id, 'tuition', 12000, d6, acc_cash_id, FALSE, NULL, e_devansh, 'cash', 'CASH-REC-109', 'Devansh Desai cash collection', ARRAY['tuition']);

  -- Previous-Year Tuition Received (Late collection attributed to prior academic year)
  INSERT INTO public.income_entries (
    user_id, academic_year_id, type, amount, date, account_id,
    is_late_collection, original_year_id, student_enrollment_id,
    payment_method, payment_reference, notes, tags
  ) VALUES
  (caller_id, curr_year_id, 'tuition', 10000, d3, acc_school_id, TRUE, prev_year_id, e_kabir_prev, 'upi', 'UPI-LATE-KABIR', 'Kabir Shah previous year balance clearance', ARRAY['old-fees', 'late-collection']),
  (caller_id, curr_year_id, 'tuition', 15000, d6, acc_cash_id, TRUE, prev_year_id, e_ananya_prev, 'cash', 'CASH-LATE-ANANYA', 'Ananya Joshi previous year fee clearance', ARRAY['old-fees', 'late-collection']);

  -- Lunch Fees
  INSERT INTO public.income_entries (
    user_id, academic_year_id, type, amount, date, account_id,
    is_late_collection, original_year_id, notes, tags
  ) VALUES
  (caller_id, curr_year_id, 'lunch', 12500, d1, acc_cash_id, FALSE, NULL, 'Class 1-5 June lunch meal collection', ARRAY['lunch']),
  (caller_id, curr_year_id, 'lunch', 14000, d4, acc_cash_id, FALSE, NULL, 'Class 1-5 July lunch meal collection', ARRAY['lunch']),
  (caller_id, curr_year_id, 'lunch', 15500, d6, acc_school_id, FALSE, NULL, 'Class 1-5 August digital lunch fee collection', ARRAY['lunch']);

  -- Other / Investment / Extra Income
  INSERT INTO public.income_entries (
    user_id, academic_year_id, type, amount, date, account_id,
    is_late_collection, original_year_id, notes, tags
  ) VALUES
  (caller_id, curr_year_id, 'other', 18000, d4, acc_school_id, FALSE, NULL, 'SBI Term Deposit quarterly interest credited', ARRAY['investment', 'interest']),
  (caller_id, curr_year_id, 'other', 22000, d2, acc_cash_id, FALSE, NULL, 'Uniform & books counter contribution', ARRAY['store', 'extra']),
  (caller_id, curr_year_id, 'other', 6500, d7, acc_cash_id, FALSE, NULL, 'Obsolete wooden furniture & paper scrap sale', ARRAY['scrap', 'other']);

  -- 8. Insert Expense Entries
  -- School Expenses
  INSERT INTO public.expense_entries (
    user_id, academic_year_id, expense_type, category, sub_category,
    amount, date, account_id, description, tags,
    is_recurring_instance, recurring_template_id
  ) VALUES
  (caller_id, curr_year_id, 'school', 'Salary & Wages', 'Teaching Staff', 85000, d2, acc_school_id, 'Monthly teaching and administrative staff salaries', ARRAY['salary', 'staff'], FALSE, NULL),
  (caller_id, curr_year_id, 'school', 'Land Rent', 'Campus Lease', 25000, d1, acc_school_id, 'School campus land ground lease rent', ARRAY['rent'], FALSE, NULL),
  (caller_id, curr_year_id, 'school', 'Electricity Bill', 'HT Power', 6800, d2, acc_school_id, 'State electricity distribution power bill', ARRAY['electricity', 'utilities'], TRUE, tmpl_electricity_id),
  (caller_id, curr_year_id, 'school', 'Academic Supplies', 'Stationery', 14500, d2, acc_school_id, 'Exam papers, report card registers & chalk boxes', ARRAY['academic', 'supplies'], FALSE, NULL),
  (caller_id, curr_year_id, 'school', 'Internet & Phone Bill', 'Fiber', 2400, d3, acc_school_id, 'Administrative broadband optical fiber connection', ARRAY['telecom'], TRUE, tmpl_internet_id),
  (caller_id, curr_year_id, 'school', 'Infrastructure & Maintenance', 'Repairs', 18000, d4, acc_school_id, 'Roof waterproofing & plumbing overhaul', ARRAY['maintenance'], FALSE, NULL),
  (caller_id, curr_year_id, 'school', 'Sports & Activities', 'Athletics', 9500, d4, acc_school_id, 'Cricket kits, volleyball nets & football sets', ARRAY['sports'], FALSE, NULL),
  (caller_id, curr_year_id, 'school', 'Events & Functions', 'National Days', 12000, d6, acc_cash_id, 'Independence Day flag-hoisting sweets, flags & sound setup', ARRAY['events'], FALSE, NULL);

  -- Home Expenses
  INSERT INTO public.expense_entries (
    user_id, academic_year_id, expense_type, category, sub_category,
    amount, date, account_id, description, tags,
    is_recurring_instance, recurring_template_id
  ) VALUES
  (caller_id, curr_year_id, 'home', 'Home Groceries', 'Household', 18000, d2, acc_personal_id, 'Monthly household grocery & provisions bill', ARRAY['home', 'groceries'], FALSE, NULL),
  (caller_id, curr_year_id, 'home', 'Family Insurance', 'Health', 12000, d4, acc_personal_id, 'Annual family health protection premium', ARRAY['home', 'medical'], FALSE, NULL),
  (caller_id, curr_year_id, 'home', 'Home Utilities', 'Maintenance', 4500, d6, acc_cash_id, 'Domestic repairs and domestic cylinder gas', ARRAY['home', 'utilities'], FALSE, NULL);

  -- 9. Insert Transfers
  INSERT INTO public.transfers (
    user_id, from_account_id, to_account_id, amount, date, category, notes
  ) VALUES
  (caller_id, acc_school_id, acc_personal_id, 30000, d4, 'school_to_personal', 'Monthly director remuneration transfer'),
  (caller_id, acc_cash_id, acc_school_id, 25000, d7, 'cash_deposit', 'Surplus cash banked into school account');

  -- 10. Insert Recoverables and Repayments
  INSERT INTO public.recoverables (
    id, user_id, party_name, original_amount, date_given, source_account_id, notes
  ) VALUES
  (rec_contractor_id, caller_id, 'Ramesh Contractor (Campus Painting)', 35000, d3, acc_school_id, 'Advance for campus auditorium interior paint work'),
  (rec_staff_id, caller_id, 'Staff Advance - Sunita Devi', 10000, d6, acc_cash_id, 'Emergency medical assistance advance for peon staff');

  INSERT INTO public.recoverable_repayments (
    user_id, recoverable_id, amount, date, account_id, notes
  ) VALUES
  (caller_id, rec_contractor_id, 15000, d7, acc_cash_id, 'First partial reimbursement against auditorium painting advance');

END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_demo_workspace()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  is_anon BOOLEAN := COALESCE((auth.jwt()->>'is_anonymous')::boolean, false);
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT is_anon THEN
    RAISE EXCEPTION 'Demo workspace functions can only be invoked by anonymous demo sessions';
  END IF;

  -- Idempotency check: if caller already has accounts or academic years, do not overwrite
  IF EXISTS (SELECT 1 FROM public.accounts WHERE user_id = caller_id)
     OR EXISTS (SELECT 1 FROM public.academic_years WHERE user_id = caller_id) THEN
    RETURN;
  END IF;

  PERFORM public.populate_demo_workspace();
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_demo_workspace()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  is_anon BOOLEAN := COALESCE((auth.jwt()->>'is_anonymous')::boolean, false);
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT is_anon THEN
    RAISE EXCEPTION 'Demo workspace functions can only be invoked by anonymous demo sessions';
  END IF;

  PERFORM public.discard_demo_workspace();
  PERFORM public.populate_demo_workspace();
END;
$$;

REVOKE ALL ON FUNCTION public.discard_demo_workspace() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.populate_demo_workspace() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_demo_workspace() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_demo_workspace() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.discard_demo_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.populate_demo_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_demo_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_workspace() TO authenticated;
