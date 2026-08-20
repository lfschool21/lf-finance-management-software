-- Forward-compatible reconciliation for the finance schema.
-- This migration deliberately fails if existing financial rows are ambiguous.

ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS carry_forward_fees NUMERIC NOT NULL DEFAULT 0;

DO $$
DECLARE
  invalid_count BIGINT;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM public.academic_years
  WHERE carry_forward_fees <> 0;
  IF invalid_count > 0 THEN
    RAISE NOTICE 'finance migration: preserving % non-zero carry_forward_fees value(s) exactly; review their legacy meaning manually', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.academic_years
  WHERE start_date > end_date
     OR target_tuition_fees < 0
     OR carry_forward_fees < 0;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % invalid academic year row(s)', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.academic_years a
  JOIN public.academic_years b
    ON a.user_id = b.user_id
   AND a.id < b.id
   AND daterange(a.start_date, a.end_date, '[]') && daterange(b.start_date, b.end_date, '[]');
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % overlapping academic year pair(s)', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count FROM public.income_entries WHERE is_late_collection IS NULL;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % income row(s) have null late-collection state', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.income_entries i
  LEFT JOIN public.academic_years y ON y.id = i.academic_year_id
  LEFT JOIN public.accounts a ON a.id = i.account_id
  WHERE y.id IS NULL OR a.id IS NULL OR y.user_id <> i.user_id OR a.user_id <> i.user_id
     OR NOT (i.date BETWEEN y.start_date AND y.end_date);
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % income row(s) have invalid ownership, references, or booking dates', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.expense_entries e
  LEFT JOIN public.academic_years y ON y.id = e.academic_year_id
  LEFT JOIN public.accounts a ON a.id = e.account_id
  LEFT JOIN public.recurring_templates r ON r.id = e.recurring_template_id
  WHERE y.id IS NULL OR a.id IS NULL OR y.user_id <> e.user_id OR a.user_id <> e.user_id
     OR NOT (e.date BETWEEN y.start_date AND y.end_date)
     OR (e.recurring_template_id IS NOT NULL AND (r.id IS NULL OR r.user_id <> e.user_id));
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % expense row(s) have invalid ownership, references, or booking dates', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.transfers t
  LEFT JOIN public.accounts source ON source.id = t.from_account_id
  LEFT JOIN public.accounts destination ON destination.id = t.to_account_id
  WHERE source.id IS NULL OR destination.id IS NULL
     OR source.user_id <> t.user_id OR destination.user_id <> t.user_id
     OR t.category <> CASE
       WHEN source.type = 'cash' AND destination.type <> 'cash' THEN 'cash_deposit'
       WHEN source.type <> 'cash' AND destination.type = 'cash' THEN 'cash_withdrawal'
       WHEN source.type = 'school_bank' AND destination.type = 'personal_bank' THEN 'school_to_personal'
       WHEN source.type = 'personal_bank' AND destination.type = 'school_bank' THEN 'personal_to_school'
       ELSE 'internal'
     END;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % transfer row(s) have invalid ownership or contradictory categories', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.income_entries
  WHERE (type <> 'tuition' AND (is_late_collection OR original_year_id IS NOT NULL))
     OR (type = 'tuition' AND is_late_collection AND original_year_id IS NULL)
     OR (type = 'tuition' AND NOT is_late_collection AND original_year_id IS NOT NULL);
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % income row(s) have ambiguous late-payment state', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.income_entries i
  JOIN public.academic_years booking ON booking.id = i.academic_year_id
  JOIN public.academic_years original ON original.id = i.original_year_id
  WHERE i.is_late_collection
    AND (booking.user_id <> i.user_id OR original.user_id <> i.user_id OR original.end_date >= booking.start_date);
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % late payment row(s) reference an invalid obligation year', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count FROM public.transfers WHERE from_account_id = to_account_id;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % self-transfer row(s)', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.expense_entries e
  LEFT JOIN public.recurring_templates r ON r.id = e.recurring_template_id
  WHERE e.recurring_template_id IS NOT NULL AND r.id IS NULL;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % orphaned recurring expense row(s)', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.expense_entries e
  JOIN public.accounts a ON a.id = e.account_id
  WHERE e.expense_type = 'home' AND a.type = 'school_bank';
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % home expense row(s) use a school account', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM (
    SELECT y.id
    FROM public.academic_years y
    LEFT JOIN public.income_entries i
      ON i.type = 'tuition'
     AND ((NOT i.is_late_collection AND i.academic_year_id = y.id)
       OR (i.is_late_collection AND i.original_year_id = y.id))
    GROUP BY y.id, y.target_tuition_fees, y.carry_forward_fees
    HAVING COALESCE(sum(i.amount), 0) > y.target_tuition_fees + y.carry_forward_fees
  ) overpaid;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'finance migration blocked: % overpaid tuition obligation(s)', invalid_count;
  END IF;
END $$;

ALTER TABLE public.academic_years
  DROP CONSTRAINT IF EXISTS academic_years_dates_check,
  DROP CONSTRAINT IF EXISTS academic_years_target_nonnegative_check,
  DROP CONSTRAINT IF EXISTS academic_years_carry_nonnegative_check;
ALTER TABLE public.academic_years
  ADD CONSTRAINT academic_years_dates_check CHECK (start_date <= end_date),
  ADD CONSTRAINT academic_years_target_nonnegative_check CHECK (target_tuition_fees >= 0),
  ADD CONSTRAINT academic_years_carry_nonnegative_check CHECK (carry_forward_fees >= 0);

ALTER TABLE public.income_entries DROP CONSTRAINT IF EXISTS income_entries_type_check;
ALTER TABLE public.income_entries
  ADD CONSTRAINT income_entries_type_check CHECK (type IN ('tuition', 'lunch', 'other')),
  ALTER COLUMN is_late_collection SET DEFAULT FALSE,
  ALTER COLUMN is_late_collection SET NOT NULL;
ALTER TABLE public.income_entries DROP CONSTRAINT IF EXISTS income_entries_late_state_check;
ALTER TABLE public.income_entries ADD CONSTRAINT income_entries_late_state_check CHECK (
  (type = 'tuition' AND is_late_collection AND original_year_id IS NOT NULL)
  OR (type = 'tuition' AND NOT is_late_collection AND original_year_id IS NULL)
  OR (type IN ('lunch', 'other') AND NOT is_late_collection AND original_year_id IS NULL)
);

ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_distinct_accounts_check;
ALTER TABLE public.transfers
  ADD CONSTRAINT transfers_distinct_accounts_check CHECK (from_account_id <> to_account_id);

ALTER TABLE public.expense_entries
  DROP CONSTRAINT IF EXISTS expense_entries_recurring_template_id_fkey;
ALTER TABLE public.expense_entries
  ADD CONSTRAINT expense_entries_recurring_template_id_fkey
  FOREIGN KEY (recurring_template_id) REFERENCES public.recurring_templates(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.validate_academic_year_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.academic_years y
    WHERE y.user_id = NEW.user_id
      AND y.id <> NEW.id
      AND daterange(y.start_date, y.end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Academic year dates overlap another configured year';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_academic_year_overlap_trigger ON public.academic_years;
CREATE TRIGGER validate_academic_year_overlap_trigger
BEFORE INSERT OR UPDATE OF user_id, start_date, end_date ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION public.validate_academic_year_overlap();

CREATE OR REPLACE FUNCTION public.validate_academic_year_financial_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  collected NUMERIC;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.income_entries i
    WHERE i.academic_year_id = NEW.id AND NOT (i.date BETWEEN NEW.start_date AND NEW.end_date)
  ) OR EXISTS (
    SELECT 1 FROM public.expense_entries e
    WHERE e.academic_year_id = NEW.id AND NOT (e.date BETWEEN NEW.start_date AND NEW.end_date)
  ) THEN
    RAISE EXCEPTION 'Academic year dates would exclude existing financial entries';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.income_entries i
    JOIN public.academic_years booking ON booking.id = i.academic_year_id
    WHERE i.is_late_collection AND i.original_year_id = NEW.id
      AND NEW.end_date >= booking.start_date
  ) OR EXISTS (
    SELECT 1 FROM public.income_entries i
    JOIN public.academic_years original ON original.id = i.original_year_id
    WHERE i.is_late_collection AND i.academic_year_id = NEW.id
      AND original.end_date >= NEW.start_date
  ) THEN
    RAISE EXCEPTION 'Academic year dates would invalidate an existing old-fee collection';
  END IF;
  SELECT COALESCE(sum(i.amount), 0) INTO collected
  FROM public.income_entries i
  WHERE i.type = 'tuition'
    AND ((NOT i.is_late_collection AND i.academic_year_id = NEW.id)
      OR (i.is_late_collection AND i.original_year_id = NEW.id));
  IF collected > NEW.target_tuition_fees + NEW.carry_forward_fees THEN
    RAISE EXCEPTION 'Tuition target plus carry-forward cannot be lower than tuition already collected';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_academic_year_financial_update_trigger ON public.academic_years;
CREATE TRIGGER validate_academic_year_financial_update_trigger
BEFORE UPDATE OF start_date, end_date, target_tuition_fees, carry_forward_fees ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION public.validate_academic_year_financial_update();

CREATE OR REPLACE FUNCTION public.validate_income_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking public.academic_years%ROWTYPE;
  original public.academic_years%ROWTYPE;
  paid NUMERIC;
BEGIN
  SELECT * INTO booking FROM public.academic_years WHERE id = NEW.academic_year_id;
  IF booking.id IS NULL OR booking.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Booking academic year does not belong to the current finance owner';
  END IF;
  IF NOT (NEW.date BETWEEN booking.start_date AND booking.end_date) THEN
    RAISE EXCEPTION 'Income date is outside the booking academic year';
  END IF;

  IF NEW.type = 'tuition' AND NEW.is_late_collection THEN
    SELECT * INTO original FROM public.academic_years WHERE id = NEW.original_year_id FOR UPDATE;
    IF original.id IS NULL OR original.user_id <> NEW.user_id OR original.end_date >= booking.start_date THEN
      RAISE EXCEPTION 'Late payment must reference a preceding academic year owned by the same user';
    END IF;
  END IF;

  IF NEW.type = 'tuition' THEN
    SELECT COALESCE(sum(i.amount), 0) INTO paid
    FROM public.income_entries i
    WHERE i.type = 'tuition'
      AND i.id <> NEW.id
      AND ((NOT i.is_late_collection AND i.academic_year_id = COALESCE(NEW.original_year_id, NEW.academic_year_id))
        OR (i.is_late_collection AND i.original_year_id = COALESCE(NEW.original_year_id, NEW.academic_year_id)));
    SELECT * INTO original
    FROM public.academic_years
    WHERE id = COALESCE(NEW.original_year_id, NEW.academic_year_id)
    FOR UPDATE;
    IF paid + NEW.amount > original.target_tuition_fees + original.carry_forward_fees THEN
      RAISE EXCEPTION 'Tuition payment exceeds remaining outstanding amount';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_income_integrity_trigger ON public.income_entries;
CREATE TRIGGER validate_income_integrity_trigger
BEFORE INSERT OR UPDATE ON public.income_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_income_integrity();

CREATE OR REPLACE FUNCTION public.validate_expense_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_owner UUID;
  account_type TEXT;
  year_owner UUID;
  year_start DATE;
  year_end DATE;
  template_owner UUID;
BEGIN
  SELECT user_id, type INTO account_owner, account_type FROM public.accounts WHERE id = NEW.account_id;
  SELECT user_id, start_date, end_date INTO year_owner, year_start, year_end FROM public.academic_years WHERE id = NEW.academic_year_id;
  IF account_owner IS DISTINCT FROM NEW.user_id OR year_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Expense references finance data owned by another user';
  END IF;
  IF NOT (NEW.date BETWEEN year_start AND year_end) THEN
    RAISE EXCEPTION 'Expense date is outside the booking academic year';
  END IF;
  IF NEW.expense_type = 'home' AND account_type = 'school_bank' THEN
    RAISE EXCEPTION 'Home expenses cannot use a school bank account';
  END IF;
  IF NEW.recurring_template_id IS NOT NULL THEN
    SELECT user_id INTO template_owner FROM public.recurring_templates WHERE id = NEW.recurring_template_id;
    IF template_owner IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Recurring template belongs to another user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_expense_integrity_trigger ON public.expense_entries;
CREATE TRIGGER validate_expense_integrity_trigger
BEFORE INSERT OR UPDATE ON public.expense_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_expense_integrity();

CREATE OR REPLACE FUNCTION public.validate_account_type_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'school_bank' AND EXISTS (
    SELECT 1 FROM public.expense_entries e
    WHERE e.account_id = NEW.id AND e.expense_type = 'home'
  ) THEN
    RAISE EXCEPTION 'An account with home-expense history cannot be changed to a school account';
  END IF;
  IF NEW.type <> OLD.type AND EXISTS (
    SELECT 1
    FROM public.transfers t
    JOIN public.accounts source ON source.id = t.from_account_id
    JOIN public.accounts destination ON destination.id = t.to_account_id
    WHERE (t.from_account_id = NEW.id OR t.to_account_id = NEW.id)
      AND t.category <> CASE
        WHEN (CASE WHEN source.id = NEW.id THEN NEW.type ELSE source.type END) = 'cash'
          AND (CASE WHEN destination.id = NEW.id THEN NEW.type ELSE destination.type END) <> 'cash' THEN 'cash_deposit'
        WHEN (CASE WHEN source.id = NEW.id THEN NEW.type ELSE source.type END) <> 'cash'
          AND (CASE WHEN destination.id = NEW.id THEN NEW.type ELSE destination.type END) = 'cash' THEN 'cash_withdrawal'
        WHEN (CASE WHEN source.id = NEW.id THEN NEW.type ELSE source.type END) = 'school_bank'
          AND (CASE WHEN destination.id = NEW.id THEN NEW.type ELSE destination.type END) = 'personal_bank' THEN 'school_to_personal'
        WHEN (CASE WHEN source.id = NEW.id THEN NEW.type ELSE source.type END) = 'personal_bank'
          AND (CASE WHEN destination.id = NEW.id THEN NEW.type ELSE destination.type END) = 'school_bank' THEN 'personal_to_school'
        ELSE 'internal'
      END
  ) THEN
    RAISE EXCEPTION 'Account type change would contradict existing transfer history';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_account_type_history_trigger ON public.accounts;
CREATE TRIGGER validate_account_type_history_trigger
BEFORE UPDATE OF type ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.validate_account_type_history();

CREATE OR REPLACE FUNCTION public.validate_transfer_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_owner UUID;
  to_owner UUID;
  from_type TEXT;
  to_type TEXT;
  expected_category TEXT;
BEGIN
  SELECT user_id, type INTO from_owner, from_type FROM public.accounts WHERE id = NEW.from_account_id;
  SELECT user_id, type INTO to_owner, to_type FROM public.accounts WHERE id = NEW.to_account_id;
  IF from_owner IS DISTINCT FROM NEW.user_id OR to_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Transfer accounts must belong to the same finance owner';
  END IF;
  expected_category := CASE
    WHEN from_type = 'cash' AND to_type <> 'cash' THEN 'cash_deposit'
    WHEN from_type <> 'cash' AND to_type = 'cash' THEN 'cash_withdrawal'
    WHEN from_type = 'school_bank' AND to_type = 'personal_bank' THEN 'school_to_personal'
    WHEN from_type = 'personal_bank' AND to_type = 'school_bank' THEN 'personal_to_school'
    ELSE 'internal'
  END;
  IF NEW.category <> expected_category THEN
    RAISE EXCEPTION 'Transfer category contradicts its account direction';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_transfer_ownership_trigger ON public.transfers;
CREATE TRIGGER validate_transfer_ownership_trigger
BEFORE INSERT OR UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.validate_transfer_ownership();
