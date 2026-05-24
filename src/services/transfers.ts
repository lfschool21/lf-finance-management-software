import { supabase } from './supabase';

export interface DbTransfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date: string;
  category: 'school_to_personal' | 'personal_to_school' | 'cash_deposit' | 'cash_withdrawal' | 'internal';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TransferInsert = Omit<DbTransfer, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export async function getAll() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  return { data: data as DbTransfer[] | null, error };
}

export async function create(input: TransferInsert) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('transfers')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  return { data: data as DbTransfer | null, error };
}

export async function update(id: string, input: Partial<TransferInsert>) {
  const { data, error } = await supabase
    .from('transfers')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return { data: data as DbTransfer | null, error };
}

export async function deleteEntry(id: string) {
  const { error } = await supabase.from('transfers').delete().eq('id', id);
  return { error };
}
