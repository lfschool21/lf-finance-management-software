import { supabase } from './supabase';

export interface DbRecurringTemplate {
  id: string;
  user_id: string;
  expense_type: 'school' | 'home';
  category: string;
  default_amount: number;
  recurrence_interval: 'monthly' | 'bimonthly' | 'quarterly';
  last_generated_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RecurringInsert = Omit<DbRecurringTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export async function getAll() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  return { data: data as DbRecurringTemplate[] | null, error };
}

export async function create(input: RecurringInsert) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('recurring_templates')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  return { data: data as DbRecurringTemplate | null, error };
}

export async function update(id: string, input: Partial<RecurringInsert>) {
  const { data, error } = await supabase
    .from('recurring_templates')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return { data: data as DbRecurringTemplate | null, error };
}

export async function toggleActive(id: string) {
  // First get current value
  const { data: current } = await supabase
    .from('recurring_templates')
    .select('is_active')
    .eq('id', id)
    .single();
  if (!current) return { data: null, error: new Error('Template not found') };
  
  return update(id, { is_active: !current.is_active });
}

export async function getTemplatesNeedingGeneration(currentMonth: number, currentYear: number) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !data) return { data: null, error };

  const firstOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const needsGeneration = (data as DbRecurringTemplate[]).filter((t) => {
    if (!t.last_generated_date) return true;
    return t.last_generated_date < firstOfMonth;
  });

  return { data: needsGeneration, error: null };
}
