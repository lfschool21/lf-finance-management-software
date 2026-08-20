import { requireUserId, supabase } from './supabase';

export interface DbAcademicYear {
  id: string;
  user_id: string;
  label: string;
  start_date: string;
  end_date: string;
  target_tuition_fees: number;
  carry_forward_fees: number;
  status: 'active' | 'closed' | 'pending_collections';
  created_at: string;
  updated_at: string;
}

export type AcademicYearInsert = Omit<DbAcademicYear, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export async function getAll() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false });
  return { data: data as DbAcademicYear[] | null, error };
}

export async function create(input: AcademicYearInsert) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('academic_years')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  return { data: data as DbAcademicYear | null, error };
}

export async function update(id: string, input: Partial<AcademicYearInsert>) {
  const { data, error } = await supabase
    .from('academic_years')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return { data: data as DbAcademicYear | null, error };
}

export async function getActiveYear() {
  const userId = await requireUserId();
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('user_id', userId)
    .lte('start_date', today)
    .gte('end_date', today)
    .single();
  return { data: data as DbAcademicYear | null, error };
}
