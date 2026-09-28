-- Account liquidity is derived from authoritative movements with a zero baseline.
--
-- Production-safety notes:
--   * Applying this migration does not update or delete any existing row.
--   * Legacy accounts.starting_balance values remain intact for audit/backup
--     compatibility, but no longer affect transfer availability.
--   * Existing function signatures are preserved for deployed clients.

CREATE OR REPLACE FUNCTION public.complete_initial_setup(
  p_accounts JSONB,
  p_year JSONB,
  p_templates JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $complete_initial_setup$
DECLARE
  owner_id UUID := auth.uid();
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_typeof(p_accounts) <> 'array' OR jsonb_array_length(p_accounts) = 0 THEN
    RAISE EXCEPTION 'Setup requires at least one account';
  END IF;
  IF jsonb_typeof(p_year) <> 'object' OR jsonb_typeof(p_templates) <> 'array' THEN
    RAISE EXCEPTION 'Invalid setup payload';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounts WHERE user_id = owner_id)
     OR EXISTS (SELECT 1 FROM public.academic_years WHERE user_id = owner_id) THEN
    RAISE EXCEPTION 'Setup cannot run because finance data already exists; review partial legacy setup safely';
  END IF;

  INSERT INTO public.accounts (user_id, name, type, starting_balance, is_archived)
  SELECT owner_id, x.name, x.type, 0, FALSE
  FROM jsonb_to_recordset(p_accounts) AS x(name TEXT, type TEXT, starting_balance NUMERIC);

  INSERT INTO public.academic_years (
    user_id, label, start_date, end_date, target_tuition_fees, carry_forward_fees, status
  ) VALUES (
    owner_id,
    p_year->>'label',
    (p_year->>'start_date')::DATE,
    (p_year->>'end_date')::DATE,
    COALESCE((p_year->>'target_tuition_fees')::NUMERIC, 0),
    COALESCE((p_year->>'carry_forward_fees')::NUMERIC, 0),
    COALESCE(p_year->>'status', 'active')
  );

  INSERT INTO public.recurring_templates (
    user_id, expense_type, category, default_amount, recurrence_interval, last_generated_date, is_active
  )
  SELECT owner_id, x.expense_type, x.category, x.default_amount, x.recurrence_interval, NULL, TRUE
  FROM jsonb_to_recordset(p_templates)
    AS x(expense_type TEXT, category TEXT, default_amount NUMERIC, recurrence_interval TEXT);
END;
$complete_initial_setup$;

CREATE OR REPLACE FUNCTION public.save_transfer(
  p_transfer_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_date DATE,
  p_category TEXT,
  p_notes TEXT
)
RETURNS public.transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $save_transfer$
DECLARE
  owner_id UUID := auth.uid();
  available NUMERIC;
  saved public.transfers%ROWTYPE;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Transfer amount and accounts are invalid';
  END IF;
  IF p_transfer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.transfers WHERE id = p_transfer_id AND user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Transfer does not belong to the current finance owner';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = p_to_account_id AND user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Destination account does not belong to the current finance owner';
  END IF;

  PERFORM 1
  FROM public.accounts
  WHERE id = p_from_account_id AND user_id = owner_id
  FOR UPDATE;

  SELECT
    COALESCE((SELECT sum(i.amount) FROM public.income_entries i WHERE i.account_id = a.id), 0)
    - COALESCE((SELECT sum(e.amount) FROM public.expense_entries e WHERE e.account_id = a.id), 0)
    + COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.to_account_id = a.id AND t.id IS DISTINCT FROM p_transfer_id), 0)
    - COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.from_account_id = a.id AND t.id IS DISTINCT FROM p_transfer_id), 0)
    - COALESCE((SELECT sum(r.original_amount) FROM public.recoverables r WHERE r.source_account_id = a.id), 0)
    + COALESCE((SELECT sum(p.amount) FROM public.recoverable_repayments p WHERE p.account_id = a.id), 0)
  INTO available
  FROM public.accounts a
  WHERE a.id = p_from_account_id AND a.user_id = owner_id;

  IF available IS NULL THEN
    RAISE EXCEPTION 'Transfer source account does not belong to the current finance owner';
  END IF;
  IF p_amount > available THEN
    RAISE EXCEPTION 'Transfer exceeds source account available balance';
  END IF;

  IF p_transfer_id IS NULL THEN
    INSERT INTO public.transfers (
      user_id, from_account_id, to_account_id, amount, date, category, notes
    ) VALUES (
      owner_id, p_from_account_id, p_to_account_id, p_amount, p_date, p_category, p_notes
    ) RETURNING * INTO saved;
  ELSE
    UPDATE public.transfers SET
      from_account_id = p_from_account_id,
      to_account_id = p_to_account_id,
      amount = p_amount,
      date = p_date,
      category = p_category,
      notes = p_notes
    WHERE id = p_transfer_id AND user_id = owner_id
    RETURNING * INTO saved;
  END IF;

  RETURN saved;
END;
$save_transfer$;

-- Preserve the old signature for rolling deployments, but remove its ability
-- to create a competing balance value. New clients use accounts UPDATE for
-- name/type edits and never call this function.
CREATE OR REPLACE FUNCTION public.set_account_current_balance(
  p_account_id UUID,
  p_name TEXT,
  p_type TEXT,
  p_current_balance NUMERIC
)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $set_account_current_balance$
DECLARE
  owner_id UUID := auth.uid();
  saved public.accounts%ROWTYPE;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(p_name)) = 0 OR p_type NOT IN ('school_bank', 'personal_bank', 'cash') THEN
    RAISE EXCEPTION 'Account name or type is invalid';
  END IF;
  IF p_current_balance IS NULL THEN
    RAISE EXCEPTION 'Current balance input is required for legacy client compatibility';
  END IF;

  PERFORM 1
  FROM public.accounts
  WHERE id = p_account_id AND user_id = owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account does not belong to the current finance owner';
  END IF;
  IF p_type = 'school_bank' AND EXISTS (
    SELECT 1 FROM public.expense_entries
    WHERE account_id = p_account_id AND expense_type = 'home'
  ) THEN
    RAISE EXCEPTION 'An account with home-expense history cannot be changed to a school account';
  END IF;

  UPDATE public.accounts
  SET name = trim(p_name), type = p_type
  WHERE id = p_account_id AND user_id = owner_id
  RETURNING * INTO saved;

  RETURN saved;
END;
$set_account_current_balance$;

REVOKE ALL ON FUNCTION public.complete_initial_setup(JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_transfer(UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_account_current_balance(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_initial_setup(JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_transfer(UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_current_balance(UUID, TEXT, TEXT, NUMERIC) TO authenticated;
