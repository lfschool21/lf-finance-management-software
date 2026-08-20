CREATE OR REPLACE FUNCTION public.complete_initial_setup(
  p_accounts JSONB,
  p_year JSONB,
  p_templates JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT owner_id, x.name, x.type, x.starting_balance, FALSE
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
$$;

CREATE OR REPLACE FUNCTION public.wipe_finance_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.recoverable_repayments WHERE user_id = owner_id;
  DELETE FROM public.recoverables WHERE user_id = owner_id;
  DELETE FROM public.transfers WHERE user_id = owner_id;
  DELETE FROM public.expense_entries WHERE user_id = owner_id;
  DELETE FROM public.income_entries WHERE user_id = owner_id;
  DELETE FROM public.recurring_templates WHERE user_id = owner_id;
  DELETE FROM public.backups_log WHERE user_id = owner_id;
  DELETE FROM public.accounts WHERE user_id = owner_id;
  DELETE FROM public.academic_years WHERE user_id = owner_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_finance_backup(p_backup JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  payload JSONB := p_backup->'data';
  version TEXT := p_backup->>'version';
  table_name TEXT;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF version NOT IN ('1.0', '2.0') OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Unsupported or malformed backup';
  END IF;
  FOREACH table_name IN ARRAY ARRAY[
    'academic_years', 'accounts', 'income_entries', 'expense_entries', 'transfers', 'recurring_templates'
  ] LOOP
    IF jsonb_typeof(payload->table_name) <> 'array' THEN
      RAISE EXCEPTION 'Backup table % is missing or is not an array', table_name;
    END IF;
  END LOOP;
  IF version = '2.0' AND (
    jsonb_typeof(payload->'recoverables') <> 'array'
    OR jsonb_typeof(payload->'recoverable_repayments') <> 'array'
  ) THEN
    RAISE EXCEPTION 'Recoverables data is missing from a version 2 backup';
  END IF;

  -- A function call is one database transaction. Any validation or insert failure
  -- rolls these deletes back automatically.
  DELETE FROM public.recoverable_repayments WHERE user_id = owner_id;
  DELETE FROM public.recoverables WHERE user_id = owner_id;
  DELETE FROM public.transfers WHERE user_id = owner_id;
  DELETE FROM public.expense_entries WHERE user_id = owner_id;
  DELETE FROM public.income_entries WHERE user_id = owner_id;
  DELETE FROM public.recurring_templates WHERE user_id = owner_id;
  DELETE FROM public.accounts WHERE user_id = owner_id;
  DELETE FROM public.academic_years WHERE user_id = owner_id;

  INSERT INTO public.academic_years (
    id, user_id, label, start_date, end_date, target_tuition_fees, carry_forward_fees,
    status, created_at, updated_at
  )
  SELECT x.id, owner_id, x.label, x.start_date, x.end_date, x.target_tuition_fees,
    COALESCE(x.carry_forward_fees, 0), x.status, COALESCE(x.created_at, NOW()), COALESCE(x.updated_at, NOW())
  FROM jsonb_to_recordset(payload->'academic_years') AS x(
    id UUID, user_id UUID, label TEXT, start_date DATE, end_date DATE,
    target_tuition_fees NUMERIC, carry_forward_fees NUMERIC, status TEXT,
    created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
  );

  INSERT INTO public.accounts (
    id, user_id, name, type, starting_balance, is_archived, created_at, updated_at
  )
  SELECT x.id, owner_id, x.name, x.type, x.starting_balance, COALESCE(x.is_archived, FALSE),
    COALESCE(x.created_at, NOW()), COALESCE(x.updated_at, NOW())
  FROM jsonb_to_recordset(payload->'accounts') AS x(
    id UUID, user_id UUID, name TEXT, type TEXT, starting_balance NUMERIC,
    is_archived BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
  );

  INSERT INTO public.recurring_templates (
    id, user_id, expense_type, category, default_amount, recurrence_interval,
    last_generated_date, is_active, created_at, updated_at
  )
  SELECT x.id, owner_id, x.expense_type, x.category, COALESCE(x.default_amount, 0),
    x.recurrence_interval, x.last_generated_date, COALESCE(x.is_active, TRUE),
    COALESCE(x.created_at, NOW()), COALESCE(x.updated_at, NOW())
  FROM jsonb_to_recordset(payload->'recurring_templates') AS x(
    id UUID, user_id UUID, expense_type TEXT, category TEXT, default_amount NUMERIC,
    recurrence_interval TEXT, last_generated_date DATE, is_active BOOLEAN,
    created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
  );

  INSERT INTO public.income_entries (
    id, user_id, academic_year_id, type, amount, date, account_id, is_late_collection,
    original_year_id, notes, tags, created_at, updated_at
  )
  SELECT x.id, owner_id, x.academic_year_id, x.type, x.amount, x.date, x.account_id,
    COALESCE(x.is_late_collection, FALSE), x.original_year_id, x.notes, x.tags,
    COALESCE(x.created_at, NOW()), COALESCE(x.updated_at, NOW())
  FROM jsonb_to_recordset(payload->'income_entries') AS x(
    id UUID, user_id UUID, academic_year_id UUID, type TEXT, amount NUMERIC, date DATE,
    account_id UUID, is_late_collection BOOLEAN, original_year_id UUID, notes TEXT,
    tags TEXT[], created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
  );

  INSERT INTO public.expense_entries (
    id, user_id, academic_year_id, expense_type, category, sub_category, amount, date,
    account_id, description, tags, is_recurring_instance, recurring_template_id,
    created_at, updated_at
  )
  SELECT x.id, owner_id, x.academic_year_id, x.expense_type, x.category, x.sub_category,
    x.amount, x.date, x.account_id, x.description, x.tags,
    COALESCE(x.is_recurring_instance, FALSE), x.recurring_template_id,
    COALESCE(x.created_at, NOW()), COALESCE(x.updated_at, NOW())
  FROM jsonb_to_recordset(payload->'expense_entries') AS x(
    id UUID, user_id UUID, academic_year_id UUID, expense_type TEXT, category TEXT,
    sub_category TEXT, amount NUMERIC, date DATE, account_id UUID, description TEXT,
    tags TEXT[], is_recurring_instance BOOLEAN, recurring_template_id UUID,
    created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
  );

  INSERT INTO public.transfers (
    id, user_id, from_account_id, to_account_id, amount, date, category, notes,
    created_at, updated_at
  )
  SELECT x.id, owner_id, x.from_account_id, x.to_account_id, x.amount, x.date,
    x.category, x.notes, COALESCE(x.created_at, NOW()), COALESCE(x.updated_at, NOW())
  FROM jsonb_to_recordset(payload->'transfers') AS x(
    id UUID, user_id UUID, from_account_id UUID, to_account_id UUID, amount NUMERIC,
    date DATE, category TEXT, notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
  );

  INSERT INTO public.recoverables (
    id, user_id, party_name, original_amount, date_given, source_account_id, notes,
    created_at, updated_at
  )
  SELECT x.id, owner_id, x.party_name, x.original_amount, x.date_given,
    x.source_account_id, x.notes, COALESCE(x.created_at, NOW()), COALESCE(x.updated_at, NOW())
  FROM jsonb_to_recordset(COALESCE(payload->'recoverables', '[]'::JSONB)) AS x(
    id UUID, user_id UUID, party_name TEXT, original_amount NUMERIC, date_given DATE,
    source_account_id UUID, notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
  );

  INSERT INTO public.recoverable_repayments (
    id, user_id, recoverable_id, amount, date, account_id, notes, created_at, updated_at
  )
  SELECT x.id, owner_id, x.recoverable_id, x.amount, x.date, x.account_id, x.notes,
    COALESCE(x.created_at, NOW()), COALESCE(x.updated_at, NOW())
  FROM jsonb_to_recordset(COALESCE(payload->'recoverable_repayments', '[]'::JSONB)) AS x(
    id UUID, user_id UUID, recoverable_id UUID, amount NUMERIC, date DATE,
    account_id UUID, notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
  );
END;
$$;

-- Atomic transfer save: serializes source-account changes while allowing backup
-- restore to preserve historical negative balances exactly as recorded.
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
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  available NUMERIC;
  saved public.transfers%ROWTYPE;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 OR p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Transfer amount and accounts are invalid';
  END IF;
  IF p_transfer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.transfers WHERE id = p_transfer_id AND user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Transfer does not belong to the current finance owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_to_account_id AND user_id = owner_id) THEN
    RAISE EXCEPTION 'Destination account does not belong to the current finance owner';
  END IF;
  PERFORM 1 FROM public.accounts WHERE id = p_from_account_id AND user_id = owner_id FOR UPDATE;
  SELECT
    a.starting_balance
    + COALESCE((SELECT sum(i.amount) FROM public.income_entries i WHERE i.account_id = a.id), 0)
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
      from_account_id = p_from_account_id, to_account_id = p_to_account_id,
      amount = p_amount, date = p_date, category = p_category, notes = p_notes
    WHERE id = p_transfer_id AND user_id = owner_id
    RETURNING * INTO saved;
  END IF;
  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_recurring_expense(
  p_template_id UUID,
  p_amount NUMERIC,
  p_date DATE,
  p_academic_year_id UUID,
  p_account_id UUID,
  p_description TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  template public.recurring_templates%ROWTYPE;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Recurring expense amount must be positive'; END IF;
  SELECT * INTO template
  FROM public.recurring_templates
  WHERE id = p_template_id AND user_id = owner_id
  FOR UPDATE;
  IF template.id IS NULL OR NOT template.is_active THEN
    RAISE EXCEPTION 'Recurring template is missing, inactive, or belongs to another user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.expense_entries e
    WHERE e.user_id = owner_id
      AND e.recurring_template_id = p_template_id
      AND e.is_recurring_instance
      AND date_trunc('month', e.date::timestamp) = date_trunc('month', p_date::timestamp)
  ) THEN
    RAISE EXCEPTION 'This recurring expense is already recorded for the selected month';
  END IF;

  INSERT INTO public.expense_entries (
    user_id, academic_year_id, expense_type, category, sub_category, amount, date,
    account_id, description, tags, is_recurring_instance, recurring_template_id
  ) VALUES (
    owner_id, p_academic_year_id, template.expense_type, template.category, NULL,
    p_amount, p_date, p_account_id, p_description, NULL, TRUE, p_template_id
  );
  UPDATE public.recurring_templates SET last_generated_date = p_date WHERE id = p_template_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_account_current_balance(
  p_account_id UUID,
  p_name TEXT,
  p_type TEXT,
  p_current_balance NUMERIC
)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  movement NUMERIC;
  saved public.accounts%ROWTYPE;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(p_name)) = 0 OR p_type NOT IN ('school_bank', 'personal_bank', 'cash') THEN
    RAISE EXCEPTION 'Account name or type is invalid';
  END IF;
  PERFORM 1 FROM public.accounts WHERE id = p_account_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account does not belong to the current finance owner'; END IF;
  IF p_type = 'school_bank' AND EXISTS (
    SELECT 1 FROM public.expense_entries WHERE account_id = p_account_id AND expense_type = 'home'
  ) THEN
    RAISE EXCEPTION 'An account with home-expense history cannot be changed to a school account';
  END IF;

  SELECT
    COALESCE((SELECT sum(i.amount) FROM public.income_entries i WHERE i.account_id = p_account_id), 0)
    - COALESCE((SELECT sum(e.amount) FROM public.expense_entries e WHERE e.account_id = p_account_id), 0)
    + COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.to_account_id = p_account_id), 0)
    - COALESCE((SELECT sum(t.amount) FROM public.transfers t WHERE t.from_account_id = p_account_id), 0)
    - COALESCE((SELECT sum(r.original_amount) FROM public.recoverables r WHERE r.source_account_id = p_account_id), 0)
    + COALESCE((SELECT sum(p.amount) FROM public.recoverable_repayments p WHERE p.account_id = p_account_id), 0)
  INTO movement;

  UPDATE public.accounts SET
    name = trim(p_name), type = p_type, starting_balance = p_current_balance - movement
  WHERE id = p_account_id AND user_id = owner_id
  RETURNING * INTO saved;
  RETURN saved;
END;
$$;

-- Transfers are written only through save_transfer so the balance check cannot be
-- bypassed with a direct PostgREST insert/update. Reads and deletes remain under RLS.
DROP POLICY IF EXISTS "Users manage own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users read own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users delete own transfers" ON public.transfers;
CREATE POLICY "Users read own transfers" ON public.transfers
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users delete own transfers" ON public.transfers
FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON FUNCTION public.complete_initial_setup(JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wipe_finance_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_finance_backup(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_transfer(UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_recurring_expense(UUID, NUMERIC, DATE, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_account_current_balance(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_initial_setup(JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wipe_finance_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_finance_backup(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_transfer(UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_recurring_expense(UUID, NUMERIC, DATE, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_current_balance(UUID, TEXT, TEXT, NUMERIC) TO authenticated;
