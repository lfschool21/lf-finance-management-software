import { requireUserId, supabase } from './supabase';

export interface DbRecoverable {
  id: string;
  user_id: string;
  party_name: string;
  original_amount: number;
  date_given: string;
  source_account_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbRecoverableRepayment {
  id: string;
  user_id: string;
  recoverable_id: string;
  amount: number;
  date: string;
  account_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type RecoverableInsert = Omit<DbRecoverable, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type RepaymentInsert = Omit<DbRecoverableRepayment, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export async function getAll() {
  const userId = await requireUserId();
  const [recoverablesResult, repaymentsResult] = await Promise.all([
    supabase.from('recoverables').select('*').eq('user_id', userId).order('date_given', { ascending: false }),
    supabase.from('recoverable_repayments').select('*').eq('user_id', userId).order('date', { ascending: false }),
  ]);
  return {
    recoverables: recoverablesResult.data as DbRecoverable[] | null,
    repayments: repaymentsResult.data as DbRecoverableRepayment[] | null,
    error: recoverablesResult.error || repaymentsResult.error,
  };
}

export async function createRecoverable(input: RecoverableInsert) {
  const userId = await requireUserId();
  const { data, error } = await supabase.from('recoverables').insert({ ...input, user_id: userId }).select().single();
  return { data: data as DbRecoverable | null, error };
}

export async function updateRecoverable(id: string, input: Partial<RecoverableInsert>) {
  const { data, error } = await supabase.from('recoverables').update(input).eq('id', id).select().single();
  return { data: data as DbRecoverable | null, error };
}

export async function deleteRecoverable(id: string) {
  const { error } = await supabase.from('recoverables').delete().eq('id', id);
  return { error };
}

export async function createRepayment(input: RepaymentInsert) {
  const userId = await requireUserId();
  const { data, error } = await supabase.from('recoverable_repayments').insert({ ...input, user_id: userId }).select().single();
  return { data: data as DbRecoverableRepayment | null, error };
}

export async function updateRepayment(id: string, input: Partial<RepaymentInsert>) {
  const { data, error } = await supabase.from('recoverable_repayments').update(input).eq('id', id).select().single();
  return { data: data as DbRecoverableRepayment | null, error };
}

export async function deleteRepayment(id: string) {
  const { error } = await supabase.from('recoverable_repayments').delete().eq('id', id);
  return { error };
}
