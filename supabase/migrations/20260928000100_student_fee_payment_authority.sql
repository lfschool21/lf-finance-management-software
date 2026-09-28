-- Make Students the authoritative entry point for tuition payments.
--
-- Production-safety notes:
--   * Existing income rows are not updated, validated, deleted, or backfilled.
--   * client_request_id is nullable so every historical row remains valid.
--   * Security-definer backup/demo functions keep their ability to restore legacy
--     unassigned tuition rows; authenticated clients can no longer insert directly.

ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS client_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS income_entries_owner_request_unique
  ON public.income_entries (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.income_entries.client_request_id IS
  'Client-generated idempotency key for student fee payment creation.';

CREATE OR REPLACE FUNCTION public.create_non_fee_income(
  p_academic_year_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_date DATE,
  p_account_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL
)
RETURNS public.income_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  created public.income_entries%ROWTYPE;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_type NOT IN ('lunch', 'other') THEN
    RAISE EXCEPTION 'Student tuition payments must be recorded from the Students section';
  END IF;

  INSERT INTO public.income_entries (
    user_id, academic_year_id, type, amount, date, account_id,
    is_late_collection, original_year_id, student_enrollment_id,
    payment_method, payment_reference, notes, tags
  ) VALUES (
    owner_id, p_academic_year_id, p_type, p_amount, p_date, p_account_id,
    FALSE, NULL, NULL, NULL, NULL, p_notes, p_tags
  )
  RETURNING * INTO created;

  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_student_fee_payment(
  p_client_request_id UUID,
  p_student_enrollment_id UUID,
  p_academic_year_id UUID,
  p_amount NUMERIC,
  p_date DATE,
  p_account_id UUID,
  p_payment_method TEXT,
  p_original_year_id UUID DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.income_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  enrollment public.student_enrollments%ROWTYPE;
  created public.income_entries%ROWTYPE;
  is_late BOOLEAN := p_original_year_id IS NOT NULL;
  obligation_year_id UUID := COALESCE(p_original_year_id, p_academic_year_id);
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'Payment request id is required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;
  IF p_payment_method NOT IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  -- Serialize retries for the same client request before checking for an
  -- existing row. This prevents a retry from reaching overpayment validation.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(owner_id::TEXT || ':' || p_client_request_id::TEXT, 0)
  );

  SELECT * INTO created
  FROM public.income_entries
  WHERE user_id = owner_id AND client_request_id = p_client_request_id;

  IF created.id IS NOT NULL THEN
    IF created.student_enrollment_id IS DISTINCT FROM p_student_enrollment_id
       OR created.amount IS DISTINCT FROM p_amount
       OR created.academic_year_id IS DISTINCT FROM p_academic_year_id
       OR created.date IS DISTINCT FROM p_date
       OR created.account_id IS DISTINCT FROM p_account_id
       OR created.payment_method IS DISTINCT FROM p_payment_method
       OR created.original_year_id IS DISTINCT FROM p_original_year_id
       OR created.payment_reference IS DISTINCT FROM NULLIF(trim(p_payment_reference), '')
       OR created.notes IS DISTINCT FROM p_notes THEN
      RAISE EXCEPTION 'Payment request id was already used for different payment details';
    END IF;
    RETURN created;
  END IF;

  SELECT * INTO enrollment
  FROM public.student_enrollments
  WHERE id = p_student_enrollment_id AND user_id = owner_id
  FOR UPDATE;

  IF enrollment.id IS NULL THEN
    RAISE EXCEPTION 'Student enrollment does not belong to the current user';
  END IF;
  IF enrollment.academic_year_id <> obligation_year_id THEN
    RAISE EXCEPTION 'Student enrollment does not match the tuition obligation academic year';
  END IF;

  INSERT INTO public.income_entries (
    user_id, academic_year_id, type, amount, date, account_id,
    is_late_collection, original_year_id, student_enrollment_id,
    payment_method, payment_reference, notes, tags, client_request_id
  ) VALUES (
    owner_id, p_academic_year_id, 'tuition', p_amount, p_date, p_account_id,
    is_late, p_original_year_id, p_student_enrollment_id,
    p_payment_method, NULLIF(trim(p_payment_reference), ''), p_notes,
    ARRAY[]::TEXT[], p_client_request_id
  )
  RETURNING * INTO created;

  RETURN created;
END;
$$;

-- Authenticated clients retain UPDATE access for the existing payment-editing
-- workflow. Do not let that permission become an alternate tuition-creation
-- or payment-unlinking route.
CREATE OR REPLACE FUNCTION public.enforce_tuition_update_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'tuition' AND OLD.type <> 'tuition' THEN
    RAISE EXCEPTION 'Student tuition payments must be created from the Students section';
  END IF;
  IF OLD.type = 'tuition'
     AND OLD.student_enrollment_id IS NOT NULL
     AND NEW.student_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'A linked student payment cannot be unlinked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_tuition_update_authority_trigger ON public.income_entries;
CREATE TRIGGER enforce_tuition_update_authority_trigger
BEFORE UPDATE ON public.income_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_tuition_update_authority();

-- Preserve request IDs in new backups while remaining compatible with older
-- backups where the field is absent (and therefore restored as NULL).
CREATE OR REPLACE FUNCTION public.restore_finance_backup(p_backup JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner_id UUID := auth.uid(); payload JSONB := p_backup->'data'; version TEXT := p_backup->>'version'; table_name TEXT;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF version NOT IN ('1.0', '2.0', '3.0') OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Unsupported or malformed backup';
  END IF;
  FOREACH table_name IN ARRAY ARRAY['academic_years','accounts','income_entries','expense_entries','transfers','recurring_templates'] LOOP
    IF jsonb_typeof(payload->table_name) <> 'array' THEN RAISE EXCEPTION 'Backup table % is missing or is not an array', table_name; END IF;
  END LOOP;
  IF version IN ('2.0','3.0') AND (jsonb_typeof(payload->'recoverables') <> 'array' OR jsonb_typeof(payload->'recoverable_repayments') <> 'array') THEN
    RAISE EXCEPTION 'Recoverables data is missing from this backup';
  END IF;
  IF version = '3.0' AND (jsonb_typeof(payload->'students') <> 'array' OR jsonb_typeof(payload->'student_enrollments') <> 'array') THEN
    RAISE EXCEPTION 'Student data is missing from a version 3 backup';
  END IF;

  DELETE FROM public.recoverable_repayments WHERE user_id = owner_id;
  DELETE FROM public.recoverables WHERE user_id = owner_id;
  DELETE FROM public.transfers WHERE user_id = owner_id;
  DELETE FROM public.expense_entries WHERE user_id = owner_id;
  DELETE FROM public.income_entries WHERE user_id = owner_id;
  DELETE FROM public.student_enrollments WHERE user_id = owner_id;
  DELETE FROM public.students WHERE user_id = owner_id;
  DELETE FROM public.recurring_templates WHERE user_id = owner_id;
  DELETE FROM public.accounts WHERE user_id = owner_id;
  DELETE FROM public.academic_years WHERE user_id = owner_id;

  INSERT INTO public.academic_years (id,user_id,label,start_date,end_date,target_tuition_fees,carry_forward_fees,status,created_at,updated_at)
  SELECT x.id,owner_id,x.label,x.start_date,x.end_date,x.target_tuition_fees,COALESCE(x.carry_forward_fees,0),x.status,COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(payload->'academic_years') AS x(id UUID,user_id UUID,label TEXT,start_date DATE,end_date DATE,target_tuition_fees NUMERIC,carry_forward_fees NUMERIC,status TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  INSERT INTO public.accounts (id,user_id,name,type,starting_balance,is_archived,created_at,updated_at)
  SELECT x.id,owner_id,x.name,x.type,x.starting_balance,COALESCE(x.is_archived,FALSE),COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(payload->'accounts') AS x(id UUID,user_id UUID,name TEXT,type TEXT,starting_balance NUMERIC,is_archived BOOLEAN,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  INSERT INTO public.recurring_templates (id,user_id,expense_type,category,default_amount,recurrence_interval,last_generated_date,is_active,created_at,updated_at)
  SELECT x.id,owner_id,x.expense_type,x.category,COALESCE(x.default_amount,0),x.recurrence_interval,x.last_generated_date,COALESCE(x.is_active,TRUE),COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(payload->'recurring_templates') AS x(id UUID,user_id UUID,expense_type TEXT,category TEXT,default_amount NUMERIC,recurrence_interval TEXT,last_generated_date DATE,is_active BOOLEAN,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  INSERT INTO public.students (id,user_id,admission_number,full_name,status,notes,created_at,updated_at)
  SELECT x.id,owner_id,x.admission_number,x.full_name,COALESCE(x.status,'active'),x.notes,COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(COALESCE(payload->'students','[]'::JSONB)) AS x(id UUID,user_id UUID,admission_number TEXT,full_name TEXT,status TEXT,notes TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  INSERT INTO public.student_enrollments (id,user_id,student_id,academic_year_id,class_name,medium,annual_fee_amount,additional_outstanding_amount,opening_collected_cash,opening_collected_upi,opening_collected_other,opening_snapshot_date,status,notes,created_at,updated_at)
  SELECT x.id,owner_id,x.student_id,x.academic_year_id,x.class_name,x.medium,x.annual_fee_amount,COALESCE(x.additional_outstanding_amount,0),COALESCE(x.opening_collected_cash,0),COALESCE(x.opening_collected_upi,0),COALESCE(x.opening_collected_other,0),x.opening_snapshot_date,COALESCE(x.status,'active'),x.notes,COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(COALESCE(payload->'student_enrollments','[]'::JSONB)) AS x(id UUID,user_id UUID,student_id UUID,academic_year_id UUID,class_name TEXT,medium TEXT,annual_fee_amount NUMERIC,additional_outstanding_amount NUMERIC,opening_collected_cash NUMERIC,opening_collected_upi NUMERIC,opening_collected_other NUMERIC,opening_snapshot_date DATE,status TEXT,notes TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  INSERT INTO public.income_entries (id,user_id,academic_year_id,type,amount,date,account_id,is_late_collection,original_year_id,notes,tags,student_enrollment_id,payment_method,payment_reference,client_request_id,created_at,updated_at)
  SELECT x.id,owner_id,x.academic_year_id,x.type,x.amount,x.date,x.account_id,COALESCE(x.is_late_collection,FALSE),x.original_year_id,x.notes,x.tags,x.student_enrollment_id,x.payment_method,x.payment_reference,x.client_request_id,COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(payload->'income_entries') AS x(id UUID,user_id UUID,academic_year_id UUID,type TEXT,amount NUMERIC,date DATE,account_id UUID,is_late_collection BOOLEAN,original_year_id UUID,notes TEXT,tags TEXT[],student_enrollment_id UUID,payment_method TEXT,payment_reference TEXT,client_request_id UUID,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  INSERT INTO public.expense_entries (id,user_id,academic_year_id,expense_type,category,sub_category,amount,date,account_id,description,tags,is_recurring_instance,recurring_template_id,created_at,updated_at)
  SELECT x.id,owner_id,x.academic_year_id,x.expense_type,x.category,x.sub_category,x.amount,x.date,x.account_id,x.description,x.tags,COALESCE(x.is_recurring_instance,FALSE),x.recurring_template_id,COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(payload->'expense_entries') AS x(id UUID,user_id UUID,academic_year_id UUID,expense_type TEXT,category TEXT,sub_category TEXT,amount NUMERIC,date DATE,account_id UUID,description TEXT,tags TEXT[],is_recurring_instance BOOLEAN,recurring_template_id UUID,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  INSERT INTO public.transfers (id,user_id,from_account_id,to_account_id,amount,date,category,notes,created_at,updated_at)
  SELECT x.id,owner_id,x.from_account_id,x.to_account_id,x.amount,x.date,x.category,x.notes,COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(payload->'transfers') AS x(id UUID,user_id UUID,from_account_id UUID,to_account_id UUID,amount NUMERIC,date DATE,category TEXT,notes TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  INSERT INTO public.recoverables (id,user_id,party_name,original_amount,date_given,source_account_id,notes,created_at,updated_at)
  SELECT x.id,owner_id,x.party_name,x.original_amount,x.date_given,x.source_account_id,x.notes,COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(COALESCE(payload->'recoverables','[]'::JSONB)) AS x(id UUID,user_id UUID,party_name TEXT,original_amount NUMERIC,date_given DATE,source_account_id UUID,notes TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  INSERT INTO public.recoverable_repayments (id,user_id,recoverable_id,amount,date,account_id,notes,created_at,updated_at)
  SELECT x.id,owner_id,x.recoverable_id,x.amount,x.date,x.account_id,x.notes,COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(COALESCE(payload->'recoverable_repayments','[]'::JSONB)) AS x(id UUID,user_id UUID,recoverable_id UUID,amount NUMERIC,date DATE,account_id UUID,notes TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
END;
$$;

-- Direct inserts previously allowed the generic Income flow to create tuition.
-- Inserts now go through one of the two narrowly scoped functions above.
REVOKE INSERT ON public.income_entries FROM authenticated;
REVOKE INSERT ON public.income_entries FROM anon;

REVOKE ALL ON FUNCTION public.create_non_fee_income(UUID, TEXT, NUMERIC, DATE, UUID, TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_student_fee_payment(UUID, UUID, UUID, NUMERIC, DATE, UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_non_fee_income(UUID, TEXT, NUMERIC, DATE, UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_fee_payment(UUID, UUID, UUID, NUMERIC, DATE, UUID, TEXT, UUID, TEXT, TEXT) TO authenticated;
