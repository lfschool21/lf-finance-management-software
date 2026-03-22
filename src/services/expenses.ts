import { supabase } from './supabase';

export interface DbExpenseEntry {
  id: string;
  user_id: string;
  academic_year_id: string;
  expense_type: 'school' | 'home';
  category: string;
  sub_category: string | null;
  amount: number;
  date: string;
  account_id: string;
  description: string | null;
  tags: string[] | null;
  is_recurring_instance: boolean;
  recurring_template_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseInsert = Omit<DbExpenseEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export async function getAll(yearId?: string) {
  const userId = await getUserId();
  let query = supabase
    .from('expense_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (yearId) query = query.eq('academic_year_id', yearId);
  const { data, error } = await query;
  return { data: data as DbExpenseEntry[] | null, error };
}

export async function create(input: ExpenseInsert) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('expense_entries')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  return { data: data as DbExpenseEntry | null, error };
}

export async function update(id: string, input: Partial<ExpenseInsert>) {
  const { data, error } = await supabase
    .from('expense_entries')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return { data: data as DbExpenseEntry | null, error };
}

export async function deleteEntry(id: string) {
  const { error } = await supabase.from('expense_entries').delete().eq('id', id);
  return { error };
}

export async function checkDuplicate(date: string, amount: number, category: string) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('expense_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('amount', amount)
    .eq('category', category);
  return { data: data as DbExpenseEntry[] | null, error };
}

export async function checkSimilarInMonth(year: number, month: number, description: string) {
  const userId = await getUserId();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  const { data, error } = await supabase
    .from('expense_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .ilike('description', `%${description}%`);
  return { data: data as DbExpenseEntry[] | null, error };
}

export async function checkCategoryInMonth(year: number, month: number, category: string) {
  const userId = await getUserId();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  const { data, error } = await supabase
    .from('expense_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('category', category);
  return { data: data as DbExpenseEntry[] | null, error };
}
