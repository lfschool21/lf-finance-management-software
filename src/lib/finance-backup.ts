import { z } from 'zod';

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.string().datetime({ offset: true }).nullable().optional();
const money = z.number().finite().nonnegative();
const positiveMoney = z.number().finite().positive();

const base = {
  id,
  user_id: id,
  created_at: timestamp,
  updated_at: timestamp,
};

const dataSchema = z.object({
  academic_years: z.array(z.object({
    ...base, label: z.string().min(1), start_date: date, end_date: date,
    target_tuition_fees: money, carry_forward_fees: money.optional(), status: z.string().min(1),
  }).passthrough()),
  accounts: z.array(z.object({
    ...base, name: z.string().min(1), type: z.enum(['school_bank', 'personal_bank', 'cash']),
    starting_balance: z.number().finite(), is_archived: z.boolean().nullable().optional(),
  }).passthrough()),
  income_entries: z.array(z.object({
    ...base, academic_year_id: id, account_id: id, type: z.enum(['tuition', 'lunch', 'other']),
    amount: positiveMoney, date, is_late_collection: z.boolean().nullable().optional(),
    original_year_id: id.nullable().optional(), notes: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
  }).passthrough()),
  expense_entries: z.array(z.object({
    ...base, academic_year_id: id, account_id: id, expense_type: z.enum(['school', 'home']),
    category: z.string().min(1), sub_category: z.string().nullable().optional(), amount: positiveMoney,
    date, description: z.string().nullable().optional(), tags: z.array(z.string()).nullable().optional(),
    is_recurring_instance: z.boolean().nullable().optional(), recurring_template_id: id.nullable().optional(),
  }).passthrough()),
  transfers: z.array(z.object({
    ...base, from_account_id: id, to_account_id: id, amount: positiveMoney, date,
    category: z.string().min(1), notes: z.string().nullable().optional(),
  }).passthrough()),
  recurring_templates: z.array(z.object({
    ...base, expense_type: z.enum(['school', 'home']), category: z.string().min(1),
    default_amount: money.nullable().optional(), recurrence_interval: z.enum(['monthly', 'bimonthly', 'quarterly']),
    last_generated_date: date.nullable().optional(), is_active: z.boolean().nullable().optional(),
  }).passthrough()),
});

const recoverablesSchema = {
  recoverables: z.array(z.object({
    ...base, party_name: z.string().min(1), original_amount: positiveMoney, date_given: date,
    source_account_id: id, notes: z.string().nullable().optional(),
  }).passthrough()),
  recoverable_repayments: z.array(z.object({
    ...base, recoverable_id: id, amount: positiveMoney, date, account_id: id,
    notes: z.string().nullable().optional(),
  }).passthrough()),
};

const backupV1 = z.object({
  version: z.literal('1.0'),
  date: z.string().datetime({ offset: true }),
  data: dataSchema,
});

const backupV2 = z.object({
  version: z.literal('2.0'),
  date: z.string().datetime({ offset: true }),
  data: dataSchema.extend(recoverablesSchema),
});

export const financeBackupSchema = z.discriminatedUnion('version', [backupV1, backupV2]);
export type FinanceBackup = z.infer<typeof financeBackupSchema>;

export function parseFinanceBackup(input: unknown): FinanceBackup {
  const result = financeBackupSchema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(`Invalid backup at ${first.path.join('.') || 'root'}: ${first.message}`);
  }
  return result.data;
}
