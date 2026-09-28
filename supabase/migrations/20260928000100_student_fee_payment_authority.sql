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
AS $create_non_fee_income$
DECLARE
  owner_id UUID := auth.uid();
  created public.income_entries%ROWTYPE;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('lunch', 'other') THEN
    RAISE EXCEPTION 'Student tuition payments must be recorded from the Students section';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Income amount must be positive';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.academic_years
    WHERE id = p_academic_year_id AND user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Academic year does not belong to the current user';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Account does not belong to the current user';
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
$create_non_fee_income$;

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
AS $record_student_fee_payment$
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
  IF p_payment_method IS NULL
     OR p_payment_method NOT IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.academic_years
    WHERE id = p_academic_year_id AND user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Booking academic year does not belong to the current user';
  END IF;
  IF p_original_year_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.academic_years
    WHERE id = p_original_year_id AND user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Original academic year does not belong to the current user';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Account does not belong to the current user';
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

  SELECT e.* INTO enrollment
  FROM public.student_enrollments e
  JOIN public.students s
    ON s.id = e.student_id AND s.user_id = owner_id
  WHERE e.id = p_student_enrollment_id AND e.user_id = owner_id
  FOR UPDATE OF e;

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
$record_student_fee_payment$;

-- Authenticated clients retain UPDATE access for the existing payment-editing
-- workflow. Do not let that permission become an alternate tuition-creation
-- or payment-unlinking route.
CREATE OR REPLACE FUNCTION public.enforce_tuition_update_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $enforce_tuition_update_authority$
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
$enforce_tuition_update_authority$;

DO $create_tuition_authority_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'enforce_tuition_update_authority_trigger'
      AND tgrelid = 'public.income_entries'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER enforce_tuition_update_authority_trigger
    BEFORE UPDATE ON public.income_entries
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tuition_update_authority();
  END IF;
END;
$create_tuition_authority_trigger$;

-- Direct inserts previously allowed the generic Income flow to create tuition.
-- Inserts now go through one of the two narrowly scoped functions above.
REVOKE INSERT ON public.income_entries FROM authenticated;
REVOKE INSERT ON public.income_entries FROM anon;

REVOKE ALL ON FUNCTION public.create_non_fee_income(UUID, TEXT, NUMERIC, DATE, UUID, TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_student_fee_payment(UUID, UUID, UUID, NUMERIC, DATE, UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_non_fee_income(UUID, TEXT, NUMERIC, DATE, UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_fee_payment(UUID, UUID, UUID, NUMERIC, DATE, UUID, TEXT, UUID, TEXT, TEXT) TO authenticated;
