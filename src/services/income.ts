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
  client_request_id: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export type IncomeInsert = Omit<
  DbIncomeEntry,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'client_request_id'
>;

export type NonFeeIncomeInsert = Omit<
  IncomeInsert,
  | 'client_request_id'
  | 'is_late_collection'
  | 'original_year_id'
  | 'payment_method'
  | 'payment_reference'
  | 'student_enrollment_id'
> & { type: 'lunch' | 'other' };

export interface StudentPaymentInsert {
  client_request_id: string;
  student_enrollment_id: string;
  academic_year_id: string;
  amount: number;
  date: string;
  account_id: string;
  payment_method: PaymentMethod;
  original_year_id: string | null;
  payment_reference: string | null;
  notes: string | null;
}

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

export async function create(input: NonFeeIncomeInsert) {
  await requireUserId();
  if ((input as { type: string }).type === 'tuition') {
    throw new Error('Student tuition payments must be recorded from the Students section');
  }
  const { data, error } = await supabase.rpc('create_non_fee_income', {
    p_academic_year_id: input.academic_year_id,
    p_type: input.type,
    p_amount: input.amount,
    p_date: input.date,
    p_account_id: input.account_id,
    p_notes: input.notes,
    p_tags: input.tags,
  });
  return { data: data as DbIncomeEntry | null, error };
}

export async function recordStudentPayment(input: StudentPaymentInsert) {
  await requireUserId();
  const { data, error } = await supabase.rpc('record_student_fee_payment', {
    p_client_request_id: input.client_request_id,
    p_student_enrollment_id: input.student_enrollment_id,
    p_academic_year_id: input.academic_year_id,
    p_amount: input.amount,
    p_date: input.date,
    p_account_id: input.account_id,
    p_payment_method: input.payment_method,
    p_original_year_id: input.original_year_id,
    p_payment_reference: input.payment_reference,
    p_notes: input.notes,
  });
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
