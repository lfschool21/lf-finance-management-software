
-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. academic_years
CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_tuition_fees NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending_collections')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_academic_years_user ON public.academic_years(user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.academic_years FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own academic_years" ON public.academic_years FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('school_bank', 'personal_bank', 'cash')),
  starting_balance NUMERIC NOT NULL DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_accounts_user ON public.accounts(user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. income_entries
CREATE TABLE public.income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  academic_year_id UUID REFERENCES public.academic_years(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('tuition', 'lunch')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) NOT NULL,
  is_late_collection BOOLEAN DEFAULT FALSE,
  original_year_id UUID REFERENCES public.academic_years(id),
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_income_user ON public.income_entries(user_id);
CREATE INDEX idx_income_year ON public.income_entries(academic_year_id);
CREATE INDEX idx_income_date ON public.income_entries(date);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.income_entries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own income" ON public.income_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. expense_entries
CREATE TABLE public.expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  academic_year_id UUID REFERENCES public.academic_years(id) NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('school', 'home')),
  category TEXT NOT NULL,
  sub_category TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) NOT NULL,
  description TEXT,
  tags TEXT[],
  is_recurring_instance BOOLEAN DEFAULT FALSE,
  recurring_template_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_expense_user ON public.expense_entries(user_id);
CREATE INDEX idx_expense_year ON public.expense_entries(academic_year_id);
CREATE INDEX idx_expense_date ON public.expense_entries(date);
CREATE INDEX idx_expense_category ON public.expense_entries(category);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.expense_entries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own expenses" ON public.expense_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. transfers
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_account_id UUID REFERENCES public.accounts(id) NOT NULL,
  to_account_id UUID REFERENCES public.accounts(id) NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('school_to_personal', 'personal_to_school', 'cash_deposit', 'cash_withdrawal', 'internal')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transfers_user ON public.transfers(user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transfers" ON public.transfers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. recurring_templates
CREATE TABLE public.recurring_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('school', 'home')),
  category TEXT NOT NULL,
  default_amount NUMERIC DEFAULT 0,
  recurrence_interval TEXT NOT NULL CHECK (recurrence_interval IN ('monthly', 'bimonthly', 'quarterly')),
  last_generated_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_recurring_user ON public.recurring_templates(user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recurring_templates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring" ON public.recurring_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. backups_log
CREATE TABLE public.backups_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('auto', 'manual')),
  backup_date TIMESTAMPTZ DEFAULT NOW(),
  file_size BIGINT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed'))
);
CREATE INDEX idx_backups_user ON public.backups_log(user_id);
ALTER TABLE public.backups_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own backups" ON public.backups_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
