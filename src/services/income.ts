import { requireUserId, supabase } from './supabase';
import type { IncomeDbType } from '@/types/finance';
import type { PaymentMethod } from '@/types/finance';

export interface DbIncomeEntry {
  id: string;
  user_id: string;
  academic_year_id: string;
  /** Stores the category name directly, e.g. 'Tuition Fees', 'Lunch Fees', 'Donation / Grant' */
  type: IncomeDbType;
  amount: number;
  date: string;
  account_id: string;
  is_late_collection: boolean;
  original_year_id: string | null;
  student_enrollment_id: string | null;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export type IncomeInsert = Omit<DbIncomeEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export async function getAll(yearId?: string) {
  const userId = await requireUserId();
  let query = supabase
    .from('income_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (yearId) query = query.eq('academic_year_id', yearId);
  const { data, error } = await query;
  return { data: data as DbIncomeEntry[] | null, error };
}

export async function create(input: IncomeInsert) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('income_entries')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  return { data: data as DbIncomeEntry | null, error };
}

export async function update(id: string, input: Partial<IncomeInsert>) {
  const { data, error } = await supabase
    .from('income_entries')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return { data: data as DbIncomeEntry | null, error };
}

export async function deleteEntry(id: string) {
  const { error } = await supabase.from('income_entries').delete().eq('id', id);
  return { error };
}

export async function getByYear(yearId: string) {
  return getAll(yearId);
}
