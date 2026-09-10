-- Fix tuition payment recording:
-- 1. In validate_income_integrity, allow tuition payments where aggregate ceiling accounts for student fee obligations
-- 2. In import_student_roster and save_student_with_enrollment, ensure academic_years.target_tuition_fees reflects enrolled student obligations
-- 3. Update existing academic years whose target_tuition_fees is less than total enrolled student obligations

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
  student_total NUMERIC;
  effective_ceiling NUMERIC;
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

    SELECT COALESCE(sum(annual_fee_amount + additional_outstanding_amount), 0) INTO student_total
    FROM public.student_enrollments
    WHERE academic_year_id = obligation_year AND user_id = NEW.user_id;

    effective_ceiling := GREATEST(original.target_tuition_fees + original.carry_forward_fees, student_total);

    IF effective_ceiling > 0 AND paid + NEW.amount > effective_ceiling THEN
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

  -- Ensure academic year target_tuition_fees accommodates student obligations
  UPDATE public.academic_years y
  SET target_tuition_fees = GREATEST(
    y.target_tuition_fees,
    (SELECT COALESCE(sum(annual_fee_amount + additional_outstanding_amount), 0)
     FROM public.student_enrollments e
     WHERE e.academic_year_id = saved_enrollment.academic_year_id AND e.user_id = owner_id)
  )
  WHERE y.id = saved_enrollment.academic_year_id AND y.user_id = owner_id;

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

    IF enrollment_exists THEN updated_count := updated_count + 1;
    ELSE added_count := added_count + 1;
    END IF;
  END LOOP;

  -- Ensure academic year target_tuition_fees reflects total student obligations
  UPDATE public.academic_years y
  SET target_tuition_fees = GREATEST(
    y.target_tuition_fees,
    (SELECT COALESCE(sum(annual_fee_amount + additional_outstanding_amount), 0)
     FROM public.student_enrollments e
     WHERE e.academic_year_id = p_academic_year_id AND e.user_id = owner_id)
  )
  WHERE y.id = p_academic_year_id AND y.user_id = owner_id;

  RETURN jsonb_build_object('added', added_count, 'updated', updated_count,
    'failed', 0, 'total', added_count + updated_count);
END;
$$;

-- Ensure all existing academic years have target_tuition_fees at least equal to their enrolled student obligations
UPDATE public.academic_years y
SET target_tuition_fees = GREATEST(
  y.target_tuition_fees,
  COALESCE((
    SELECT sum(e.annual_fee_amount + e.additional_outstanding_amount)
    FROM public.student_enrollments e
    WHERE e.academic_year_id = y.id AND e.user_id = y.user_id
  ), 0)
)
WHERE EXISTS (
  SELECT 1 FROM public.student_enrollments e
  WHERE e.academic_year_id = y.id AND e.user_id = y.user_id
);
