\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','student-owner-a@local.test',crypt('Local123!',gen_salt('bf')),NOW(),'{}','{}',NOW(),NOW()),
('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','student-owner-b@local.test',crypt('Local123!',gen_salt('bf')),NOW(),'{}','{}',NOW(),NOW());

INSERT INTO public.academic_years (id,user_id,label,start_date,end_date,target_tuition_fees,carry_forward_fees,status) VALUES
('a1111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2025-26','2025-06-01','2026-05-31',100000,0,'closed'),
('a2222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-27','2026-06-01','2027-05-31',200000,0,'active'),
('b2222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-27','2026-06-01','2027-05-31',200000,0,'active');
INSERT INTO public.accounts (id,user_id,name,type,starting_balance) VALUES
('a3333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Owner A Bank','school_bank',0),
('b3333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Owner B Bank','school_bank',0);
INSERT INTO public.students (id,user_id,admission_number,full_name) VALUES
('a4444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A-1','Student A'),
('b4444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B-1','Student B');
INSERT INTO public.student_enrollments (id,user_id,student_id,academic_year_id,class_name,medium,annual_fee_amount,opening_collected_cash) VALUES
('a5555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4444444-4444-4444-8444-444444444444','a2222222-2222-4222-8222-222222222222','Class 6','english',30000,10000),
('a6666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4444444-4444-4444-8444-444444444444','a1111111-1111-4111-8111-111111111111','Class 5','english',20000,5000),
('b5555555-5555-4555-8555-555555555555','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b4444444-4444-4444-8444-444444444444','b2222222-2222-4222-8222-222222222222','Class 6','gujarati',30000,0);

INSERT INTO public.income_entries (user_id,academic_year_id,type,amount,date,account_id,is_late_collection,original_year_id,student_enrollment_id,payment_method)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2222222-2222-4222-8222-222222222222','tuition',10000,'2026-08-01','a3333333-3333-4333-8333-333333333333',FALSE,NULL,'a5555555-5555-4555-8555-555555555555','upi');

INSERT INTO public.income_entries (user_id,academic_year_id,type,amount,date,account_id,is_late_collection,original_year_id,student_enrollment_id,payment_method)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2222222-2222-4222-8222-222222222222','tuition',5000,'2026-08-02','a3333333-3333-4333-8333-333333333333',TRUE,'a1111111-1111-4111-8111-111111111111','a6666666-6666-4666-8666-666666666666','cash');

DO $$
BEGIN
  BEGIN
    INSERT INTO public.income_entries (user_id,academic_year_id,type,amount,date,account_id,is_late_collection,original_year_id,student_enrollment_id,payment_method)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2222222-2222-4222-8222-222222222222','tuition',10001,'2026-08-03','a3333333-3333-4333-8333-333333333333',FALSE,NULL,'a5555555-5555-4555-8555-555555555555','cash');
    RAISE EXCEPTION 'Student overpayment was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Student overpayment was not rejected' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.income_entries (user_id,academic_year_id,type,amount,date,account_id,is_late_collection,original_year_id,student_enrollment_id,payment_method)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2222222-2222-4222-8222-222222222222','tuition',1,'2026-08-03','a3333333-3333-4333-8333-333333333333',FALSE,NULL,'b5555555-5555-4555-8555-555555555555','cash');
    RAISE EXCEPTION 'Cross-user enrollment was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Cross-user enrollment was not rejected' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.income_entries (user_id,academic_year_id,type,amount,date,account_id,is_late_collection,original_year_id,student_enrollment_id,payment_method)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2222222-2222-4222-8222-222222222222','tuition',1,'2026-08-03','a3333333-3333-4333-8333-333333333333',FALSE,NULL,'a6666666-6666-4666-8666-666666666666','cash');
    RAISE EXCEPTION 'Enrollment-year mismatch was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Enrollment-year mismatch was not rejected' THEN RAISE; END IF;
  END;
END $$;

SELECT CASE WHEN (
  SELECT opening_collected_cash + COALESCE((SELECT sum(amount) FROM public.income_entries WHERE student_enrollment_id = e.id),0)
  FROM public.student_enrollments e WHERE e.id = 'a5555555-5555-4555-8555-555555555555'
) = 20000 THEN 'PASS' ELSE 'FAIL' END AS student_subledger_total;

ROLLBACK;
