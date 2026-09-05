-- Student roster and fee subledger. Financial cash remains in income_entries.

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admission_number TEXT,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'left')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT students_name_check CHECK (length(trim(full_name)) BETWEEN 1 AND 200),
  CONSTRAINT students_admission_check CHECK (admission_number IS NULL OR length(trim(admission_number)) BETWEEN 1 AND 80),
  CONSTRAINT students_notes_check CHECK (notes IS NULL OR length(notes) <= 4000)
);

CREATE UNIQUE INDEX students_owner_admission_unique
  ON public.students (user_id, lower(trim(admission_number)))
  WHERE admission_number IS NOT NULL;
CREATE INDEX students_owner_idx ON public.students(user_id);
CREATE INDEX students_owner_name_idx ON public.students(user_id, lower(full_name));

CREATE TABLE public.student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  class_name TEXT NOT NULL,
  medium TEXT NOT NULL CHECK (medium IN ('english', 'gujarati')),
  annual_fee_amount NUMERIC NOT NULL DEFAULT 0 CHECK (annual_fee_amount >= 0),
  additional_outstanding_amount NUMERIC NOT NULL DEFAULT 0 CHECK (additional_outstanding_amount >= 0),
  opening_collected_cash NUMERIC NOT NULL DEFAULT 0 CHECK (opening_collected_cash >= 0),
  opening_collected_upi NUMERIC NOT NULL DEFAULT 0 CHECK (opening_collected_upi >= 0),
  opening_collected_other NUMERIC NOT NULL DEFAULT 0 CHECK (opening_collected_other >= 0),
  opening_snapshot_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'left')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_enrollments_unique UNIQUE (student_id, academic_year_id),
  CONSTRAINT student_enrollments_class_check CHECK (length(trim(class_name)) BETWEEN 1 AND 100),
  CONSTRAINT student_enrollments_notes_check CHECK (notes IS NULL OR length(notes) <= 4000),
  CONSTRAINT student_enrollments_opening_check CHECK (
    opening_collected_cash + opening_collected_upi + opening_collected_other
      <= annual_fee_amount + additional_outstanding_amount
  )
);

CREATE INDEX student_enrollments_owner_idx ON public.student_enrollments(user_id);
CREATE INDEX student_enrollments_student_idx ON public.student_enrollments(student_id);
CREATE INDEX student_enrollments_year_idx ON public.student_enrollments(academic_year_id);
CREATE INDEX student_enrollments_roster_idx ON public.student_enrollments(user_id, academic_year_id, status);
CREATE INDEX student_enrollments_class_idx ON public.student_enrollments(user_id, academic_year_id, class_name);
CREATE INDEX student_enrollments_medium_idx ON public.student_enrollments(user_id, academic_year_id, medium);

ALTER TABLE public.income_entries
  ADD COLUMN student_enrollment_id UUID REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  ADD COLUMN payment_method TEXT,
  ADD COLUMN payment_reference TEXT;

ALTER TABLE public.income_entries
  ADD CONSTRAINT income_entries_payment_method_check CHECK (
    payment_method IS NULL OR payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')
  ),
  ADD CONSTRAINT income_entries_student_payment_check CHECK (
    student_enrollment_id IS NULL OR (type = 'tuition' AND payment_method IS NOT NULL)
  ),
  ADD CONSTRAINT income_entries_payment_reference_check CHECK (
    payment_reference IS NULL OR length(payment_reference) <= 200
  );

CREATE INDEX income_entries_student_enrollment_idx
  ON public.income_entries(student_enrollment_id) WHERE student_enrollment_id IS NOT NULL;
CREATE INDEX income_entries_payment_method_idx
  ON public.income_entries(user_id, payment_method) WHERE payment_method IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.student_enrollments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own students" ON public.students
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own student enrollments" ON public.student_enrollments
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_student_enrollment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_owner UUID;
  year_owner UUID;
  recorded NUMERIC;
BEGIN
  SELECT user_id INTO student_owner FROM public.students WHERE id = NEW.student_id;
  SELECT user_id INTO year_owner FROM public.academic_years WHERE id = NEW.academic_year_id;
  IF student_owner IS DISTINCT FROM NEW.user_id OR year_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Student enrollment references data owned by another user';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(sum(i.amount), 0) INTO recorded
    FROM public.income_entries i
    WHERE i.student_enrollment_id = NEW.id;
    IF recorded + NEW.opening_collected_cash + NEW.opening_collected_upi + NEW.opening_collected_other
       > NEW.annual_fee_amount + NEW.additional_outstanding_amount THEN
      RAISE EXCEPTION 'Student fee obligation cannot be lower than collections already recorded';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_student_enrollment_integrity_trigger
BEFORE INSERT OR UPDATE ON public.student_enrollments
FOR EACH ROW EXECUTE FUNCTION public.validate_student_enrollment_integrity();

-- Extends the existing aggregate validation without changing its accounting meaning.
CREATE OR REPLACE FUNCTION public.validate_income_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking public.academic_years%ROWTYPE;
  original public.academic_years%ROWTYPE;
  enrollment public.student_enrollments%ROWTYPE;
  account_owner UUID;
  paid NUMERIC;
  student_paid NUMERIC;
  obligation_year UUID;
BEGIN
  IF NEW.amount <= 0 THEN RAISE EXCEPTION 'Income amount must be positive'; END IF;
  SELECT * INTO booking FROM public.academic_years WHERE id = NEW.academic_year_id;
  SELECT user_id INTO account_owner FROM public.accounts WHERE id = NEW.account_id;
  IF booking.id IS NULL OR booking.user_id <> NEW.user_id OR account_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Income references finance data owned by another user';
  END IF;
  IF NOT (NEW.date BETWEEN booking.start_date AND booking.end_date) THEN
    RAISE EXCEPTION 'Income date is outside the booking academic year';
  END IF;

  obligation_year := COALESCE(NEW.original_year_id, NEW.academic_year_id);
  IF NEW.type = 'tuition' AND NEW.is_late_collection THEN
    SELECT * INTO original FROM public.academic_years WHERE id = NEW.original_year_id FOR UPDATE;
    IF original.id IS NULL OR original.user_id <> NEW.user_id OR original.end_date >= booking.start_date THEN
      RAISE EXCEPTION 'Late payment must reference a preceding academic year owned by the same user';
    END IF;
  END IF;

  IF NEW.student_enrollment_id IS NOT NULL THEN
    SELECT * INTO enrollment FROM public.student_enrollments
    WHERE id = NEW.student_enrollment_id FOR UPDATE;
    IF enrollment.id IS NULL OR enrollment.user_id <> NEW.user_id THEN
      RAISE EXCEPTION 'Student enrollment does not belong to the current finance owner';
    END IF;
    IF NEW.type <> 'tuition' OR NEW.payment_method IS NULL THEN
      RAISE EXCEPTION 'A student-linked income entry must be tuition with a payment method';
    END IF;
    IF enrollment.academic_year_id <> obligation_year THEN
      RAISE EXCEPTION 'Student enrollment does not match the tuition obligation academic year';
    END IF;
    IF (NEW.is_late_collection AND enrollment.academic_year_id <> NEW.original_year_id)
       OR (NOT NEW.is_late_collection AND enrollment.academic_year_id <> NEW.academic_year_id) THEN
      RAISE EXCEPTION 'Student payment has invalid current/previous-year attribution';
    END IF;

    SELECT COALESCE(sum(i.amount), 0) INTO student_paid
    FROM public.income_entries i
    WHERE i.student_enrollment_id = enrollment.id AND i.id <> NEW.id;
    student_paid := student_paid + enrollment.opening_collected_cash
      + enrollment.opening_collected_upi + enrollment.opening_collected_other;
    IF student_paid + NEW.amount > enrollment.annual_fee_amount + enrollment.additional_outstanding_amount THEN
      RAISE EXCEPTION 'Student payment exceeds the student remaining fee obligation';
    END IF;
  END IF;

  IF NEW.type = 'tuition' THEN
    SELECT COALESCE(sum(i.amount), 0) INTO paid
    FROM public.income_entries i
    WHERE i.type = 'tuition' AND i.id <> NEW.id
      AND ((NOT i.is_late_collection AND i.academic_year_id = obligation_year)
        OR (i.is_late_collection AND i.original_year_id = obligation_year));
    SELECT * INTO original FROM public.academic_years WHERE id = obligation_year FOR UPDATE;
    IF paid + NEW.amount > original.target_tuition_fees + original.carry_forward_fees THEN
      RAISE EXCEPTION 'Tuition payment exceeds remaining outstanding amount';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_student_with_enrollment(p_student JSONB, p_enrollment JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  saved_student public.students%ROWTYPE;
  saved_enrollment public.student_enrollments%ROWTYPE;
  requested_student_id UUID := NULLIF(p_student->>'id', '')::UUID;
  requested_enrollment_id UUID := NULLIF(p_enrollment->>'id', '')::UUID;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF requested_student_id IS NULL THEN
    INSERT INTO public.students (user_id, admission_number, full_name, status, notes)
    VALUES (owner_id, NULLIF(trim(p_student->>'admission_number'), ''), trim(p_student->>'full_name'),
      COALESCE(NULLIF(p_student->>'status', ''), 'active'), NULLIF(p_student->>'notes', ''))
    RETURNING * INTO saved_student;
  ELSE
    UPDATE public.students SET
      admission_number = NULLIF(trim(p_student->>'admission_number'), ''),
      full_name = trim(p_student->>'full_name'),
      status = COALESCE(NULLIF(p_student->>'status', ''), status),
      notes = NULLIF(p_student->>'notes', '')
    WHERE id = requested_student_id AND user_id = owner_id RETURNING * INTO saved_student;
    IF saved_student.id IS NULL THEN RAISE EXCEPTION 'Student does not belong to the current user'; END IF;
  END IF;

  IF requested_enrollment_id IS NULL THEN
    INSERT INTO public.student_enrollments (
      user_id, student_id, academic_year_id, class_name, medium, annual_fee_amount,
      additional_outstanding_amount, opening_collected_cash, opening_collected_upi,
      opening_collected_other, opening_snapshot_date, status, notes
    ) VALUES (
      owner_id, saved_student.id, (p_enrollment->>'academic_year_id')::UUID,
      trim(p_enrollment->>'class_name'), p_enrollment->>'medium',
      COALESCE((p_enrollment->>'annual_fee_amount')::NUMERIC, 0),
      COALESCE((p_enrollment->>'additional_outstanding_amount')::NUMERIC, 0),
      COALESCE((p_enrollment->>'opening_collected_cash')::NUMERIC, 0),
      COALESCE((p_enrollment->>'opening_collected_upi')::NUMERIC, 0),
      COALESCE((p_enrollment->>'opening_collected_other')::NUMERIC, 0),
      NULLIF(p_enrollment->>'opening_snapshot_date', '')::DATE,
      COALESCE(NULLIF(p_enrollment->>'status', ''), 'active'), NULLIF(p_enrollment->>'notes', '')
    ) RETURNING * INTO saved_enrollment;
  ELSE
    UPDATE public.student_enrollments SET
      class_name = trim(p_enrollment->>'class_name'), medium = p_enrollment->>'medium',
      annual_fee_amount = COALESCE((p_enrollment->>'annual_fee_amount')::NUMERIC, 0),
      additional_outstanding_amount = COALESCE((p_enrollment->>'additional_outstanding_amount')::NUMERIC, 0),
      opening_collected_cash = COALESCE((p_enrollment->>'opening_collected_cash')::NUMERIC, 0),
      opening_collected_upi = COALESCE((p_enrollment->>'opening_collected_upi')::NUMERIC, 0),
      opening_collected_other = COALESCE((p_enrollment->>'opening_collected_other')::NUMERIC, 0),
      opening_snapshot_date = NULLIF(p_enrollment->>'opening_snapshot_date', '')::DATE,
      status = COALESCE(NULLIF(p_enrollment->>'status', ''), status),
      notes = NULLIF(p_enrollment->>'notes', '')
    WHERE id = requested_enrollment_id
      AND public.student_enrollments.student_id = saved_student.id
      AND user_id = owner_id
    RETURNING * INTO saved_enrollment;
    IF saved_enrollment.id IS NULL THEN RAISE EXCEPTION 'Enrollment does not belong to this student'; END IF;
  END IF;
  RETURN jsonb_build_object('student', to_jsonb(saved_student), 'enrollment', to_jsonb(saved_enrollment));
END;
$$;

CREATE OR REPLACE FUNCTION public.import_student_roster(p_academic_year_id UUID, p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  row_data JSONB;
  saved_student public.students%ROWTYPE;
  existing_id UUID;
  added_count INTEGER := 0;
  updated_count INTEGER := 0;
  enrollment_exists BOOLEAN;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.academic_years WHERE id = p_academic_year_id AND user_id = owner_id) THEN
    RAISE EXCEPTION 'Academic year does not belong to the current user';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 5000 THEN
    RAISE EXCEPTION 'Import must contain an array of at most 5000 rows';
  END IF;

  FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    existing_id := NULLIF(row_data->>'student_id', '')::UUID;
    IF existing_id IS NULL AND NULLIF(trim(row_data->>'admission_number'), '') IS NOT NULL THEN
      SELECT id INTO existing_id FROM public.students
      WHERE user_id = owner_id
        AND lower(trim(admission_number)) = lower(trim(row_data->>'admission_number'));
    END IF;
    IF existing_id IS NOT NULL THEN
      UPDATE public.students SET
        admission_number = NULLIF(trim(row_data->>'admission_number'), ''),
        full_name = trim(row_data->>'full_name'), notes = NULLIF(row_data->>'student_notes', '')
      WHERE id = existing_id AND user_id = owner_id RETURNING * INTO saved_student;
      IF saved_student.id IS NULL THEN RAISE EXCEPTION 'Import row references another user''s student'; END IF;
    ELSE
      INSERT INTO public.students (user_id, admission_number, full_name, notes)
      VALUES (owner_id, NULLIF(trim(row_data->>'admission_number'), ''), trim(row_data->>'full_name'),
        NULLIF(row_data->>'student_notes', '')) RETURNING * INTO saved_student;
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.student_enrollments
      WHERE student_id = saved_student.id AND academic_year_id = p_academic_year_id)
      INTO enrollment_exists;
    INSERT INTO public.student_enrollments (
      user_id, student_id, academic_year_id, class_name, medium, annual_fee_amount,
      additional_outstanding_amount, opening_collected_cash, opening_collected_upi,
      opening_collected_other, opening_snapshot_date, notes
    ) VALUES (
      owner_id, saved_student.id, p_academic_year_id, trim(row_data->>'class_name'),
      row_data->>'medium', (row_data->>'annual_fee_amount')::NUMERIC,
      COALESCE((row_data->>'additional_outstanding_amount')::NUMERIC, 0),
      COALESCE((row_data->>'opening_collected_cash')::NUMERIC, 0),
      COALESCE((row_data->>'opening_collected_upi')::NUMERIC, 0),
      COALESCE((row_data->>'opening_collected_other')::NUMERIC, 0),
      NULLIF(row_data->>'opening_snapshot_date', '')::DATE, NULLIF(row_data->>'enrollment_notes', '')
    ) ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
      class_name = EXCLUDED.class_name, medium = EXCLUDED.medium,
      annual_fee_amount = EXCLUDED.annual_fee_amount,
      additional_outstanding_amount = EXCLUDED.additional_outstanding_amount,
      opening_collected_cash = EXCLUDED.opening_collected_cash,
      opening_collected_upi = EXCLUDED.opening_collected_upi,
      opening_collected_other = EXCLUDED.opening_collected_other,
      opening_snapshot_date = EXCLUDED.opening_snapshot_date,
      notes = EXCLUDED.notes;
    IF NULLIF(row_data->>'previous_academic_year_id', '') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.academic_years
        WHERE id = (row_data->>'previous_academic_year_id')::UUID AND user_id = owner_id
          AND id <> p_academic_year_id) THEN
        RAISE EXCEPTION 'Import row contains an invalid previous academic year';
      END IF;
      INSERT INTO public.student_enrollments (
        user_id, student_id, academic_year_id, class_name, medium, annual_fee_amount,
        additional_outstanding_amount, opening_collected_cash, opening_collected_upi,
        opening_collected_other, opening_snapshot_date, notes
      ) VALUES (
        owner_id, saved_student.id, (row_data->>'previous_academic_year_id')::UUID,
        trim(row_data->>'previous_class_name'), row_data->>'previous_medium',
        (row_data->>'previous_annual_fee_amount')::NUMERIC, 0,
        COALESCE((row_data->>'previous_opening_collected_cash')::NUMERIC, 0),
        COALESCE((row_data->>'previous_opening_collected_upi')::NUMERIC, 0),
        COALESCE((row_data->>'previous_opening_collected_other')::NUMERIC, 0),
        NULLIF(row_data->>'opening_snapshot_date', '')::DATE,
        'Imported historical fee balance'
      ) ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
        annual_fee_amount = EXCLUDED.annual_fee_amount,
        opening_collected_cash = EXCLUDED.opening_collected_cash,
        opening_collected_upi = EXCLUDED.opening_collected_upi,
        opening_collected_other = EXCLUDED.opening_collected_other,
        opening_snapshot_date = EXCLUDED.opening_snapshot_date;
    END IF;
    IF enrollment_exists THEN updated_count := updated_count + 1; ELSE added_count := added_count + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('added', added_count, 'updated', updated_count, 'failed', 0,
    'total', added_count + updated_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_student(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id UUID := auth.uid();
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.students SET status = 'inactive' WHERE id = p_student_id AND user_id = owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student does not belong to the current user'; END IF;
  UPDATE public.student_enrollments SET status = 'inactive'
  WHERE student_id = p_student_id AND user_id = owner_id AND status = 'active';
END;
$$;

-- Backup 3.0 adds students, enrollments, and student-payment metadata while retaining 1.0/2.0 restore support.
CREATE OR REPLACE FUNCTION public.wipe_finance_data()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id UUID := auth.uid();
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.recoverable_repayments WHERE user_id = owner_id;
  DELETE FROM public.recoverables WHERE user_id = owner_id;
  DELETE FROM public.transfers WHERE user_id = owner_id;
  DELETE FROM public.expense_entries WHERE user_id = owner_id;
  DELETE FROM public.income_entries WHERE user_id = owner_id;
  DELETE FROM public.student_enrollments WHERE user_id = owner_id;
  DELETE FROM public.students WHERE user_id = owner_id;
  DELETE FROM public.recurring_templates WHERE user_id = owner_id;
  DELETE FROM public.backups_log WHERE user_id = owner_id;
  DELETE FROM public.accounts WHERE user_id = owner_id;
  DELETE FROM public.academic_years WHERE user_id = owner_id;
END;
$$;

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
  INSERT INTO public.income_entries (id,user_id,academic_year_id,type,amount,date,account_id,is_late_collection,original_year_id,notes,tags,student_enrollment_id,payment_method,payment_reference,created_at,updated_at)
  SELECT x.id,owner_id,x.academic_year_id,x.type,x.amount,x.date,x.account_id,COALESCE(x.is_late_collection,FALSE),x.original_year_id,x.notes,x.tags,x.student_enrollment_id,x.payment_method,x.payment_reference,COALESCE(x.created_at,NOW()),COALESCE(x.updated_at,NOW())
  FROM jsonb_to_recordset(payload->'income_entries') AS x(id UUID,user_id UUID,academic_year_id UUID,type TEXT,amount NUMERIC,date DATE,account_id UUID,is_late_collection BOOLEAN,original_year_id UUID,notes TEXT,tags TEXT[],student_enrollment_id UUID,payment_method TEXT,payment_reference TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
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

REVOKE ALL ON FUNCTION public.save_student_with_enrollment(JSONB,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_student_roster(UUID,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_student(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wipe_finance_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_finance_backup(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_student_with_enrollment(JSONB,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_student_roster(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wipe_finance_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_finance_backup(JSONB) TO authenticated;
