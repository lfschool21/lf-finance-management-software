import { requireUserId, supabase } from './supabase';

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

export async function getAll() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  return { data: data as DbTransfer[] | null, error };
}

export async function create(input: TransferInsert) {
  await requireUserId();
  const { data, error } = await supabase.rpc('save_transfer', {
    p_transfer_id: null,
    p_from_account_id: input.from_account_id,
    p_to_account_id: input.to_account_id,
    p_amount: input.amount,
    p_date: input.date,
    p_category: input.category,
    p_notes: input.notes,
  });
  return { data: data as DbTransfer | null, error };
}

export async function update(id: string, input: TransferInsert) {
  await requireUserId();
  const { data, error } = await supabase.rpc('save_transfer', {
    p_transfer_id: id,
    p_from_account_id: input.from_account_id,
    p_to_account_id: input.to_account_id,
    p_amount: input.amount,
    p_date: input.date,
    p_category: input.category,
    p_notes: input.notes,
  });
  return { data: data as DbTransfer | null, error };
}

export async function deleteEntry(id: string) {
  const { error } = await supabase.from('transfers').delete().eq('id', id);
  return { error };
}
