CREATE TABLE IF NOT EXISTS public.recoverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  party_name TEXT NOT NULL CHECK (length(trim(party_name)) > 0),
  original_amount NUMERIC NOT NULL CHECK (original_amount > 0),
  date_given DATE NOT NULL,
  source_account_id UUID REFERENCES public.accounts(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recoverable_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recoverable_id UUID REFERENCES public.recoverables(id) ON DELETE RESTRICT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recoverables_user ON public.recoverables(user_id);
CREATE INDEX IF NOT EXISTS idx_recoverables_account ON public.recoverables(source_account_id);
CREATE INDEX IF NOT EXISTS idx_recoverable_repayments_user ON public.recoverable_repayments(user_id);
CREATE INDEX IF NOT EXISTS idx_recoverable_repayments_parent ON public.recoverable_repayments(recoverable_id);
CREATE INDEX IF NOT EXISTS idx_recoverable_repayments_account ON public.recoverable_repayments(account_id);

ALTER TABLE public.recoverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recoverable_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recoverables" ON public.recoverables
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own recoverable repayments" ON public.recoverable_repayments
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recoverables
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recoverable_repayments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.validate_recoverable_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_owner UUID;
  already_repaid NUMERIC;
BEGIN
  SELECT user_id INTO account_owner FROM public.accounts WHERE id = NEW.source_account_id;
  IF account_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Recoverable source account belongs to another user';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(sum(amount), 0) INTO already_repaid
    FROM public.recoverable_repayments WHERE recoverable_id = NEW.id;
    IF NEW.original_amount < already_repaid THEN
      RAISE EXCEPTION 'Original amount cannot be lower than repayments already received';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.recoverable_repayments
      WHERE recoverable_id = NEW.id AND date < NEW.date_given
    ) THEN
      RAISE EXCEPTION 'Advance date cannot be later than an existing repayment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_recoverable_integrity_trigger
BEFORE INSERT OR UPDATE ON public.recoverables
FOR EACH ROW EXECUTE FUNCTION public.validate_recoverable_integrity();

CREATE OR REPLACE FUNCTION public.validate_recoverable_repayment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent public.recoverables%ROWTYPE;
  account_owner UUID;
  already_repaid NUMERIC;
BEGIN
  SELECT * INTO parent FROM public.recoverables WHERE id = NEW.recoverable_id FOR UPDATE;
  SELECT user_id INTO account_owner FROM public.accounts WHERE id = NEW.account_id;
  IF parent.id IS NULL OR parent.user_id <> NEW.user_id OR account_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Repayment references finance data owned by another user';
  END IF;
  SELECT COALESCE(sum(amount), 0) INTO already_repaid
  FROM public.recoverable_repayments
  WHERE recoverable_id = NEW.recoverable_id AND id <> NEW.id;
  IF already_repaid + NEW.amount > parent.original_amount THEN
    RAISE EXCEPTION 'Repayment exceeds the remaining recoverable amount';
  END IF;
  IF NEW.date < parent.date_given THEN
    RAISE EXCEPTION 'Repayment date cannot be before the advance date';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_recoverable_repayment_trigger
BEFORE INSERT OR UPDATE ON public.recoverable_repayments
FOR EACH ROW EXECUTE FUNCTION public.validate_recoverable_repayment();
