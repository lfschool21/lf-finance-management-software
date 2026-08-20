import { requireUserId, supabase } from './supabase';

export interface DbAccount {
  id: string;
  user_id: string;
  name: string;
  type: 'school_bank' | 'personal_bank' | 'cash';
  starting_balance: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type AccountInsert = Omit<DbAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export async function getAll() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at');
  return { data: data as DbAccount[] | null, error };
}

export async function getAllIncludingArchived() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  return { data: data as DbAccount[] | null, error };
}

export async function create(input: AccountInsert) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('accounts')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  return { data: data as DbAccount | null, error };
}

export async function update(id: string, input: Partial<AccountInsert>) {
  const { data, error } = await supabase
    .from('accounts')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return { data: data as DbAccount | null, error };
}

export async function setCurrentBalance(id: string, input: { name: string; type: DbAccount['type']; currentBalance: number }) {
  const { data, error } = await supabase.rpc('set_account_current_balance', {
    p_account_id: id,
    p_name: input.name,
    p_type: input.type,
    p_current_balance: input.currentBalance,
  });
  return { data: data as DbAccount | null, error };
}

export async function unarchive(id: string) {
  return update(id, { is_archived: false } as Partial<AccountInsert>);
}

export async function archive(id: string) {
  return update(id, { is_archived: true } as Partial<AccountInsert>);
}
