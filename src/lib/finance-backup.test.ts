import { describe, expect, it } from 'vitest';
import { parseFinanceBackup } from './finance-backup';

const emptyV2 = {
  version: '2.0', date: '2026-08-21T10:00:00.000Z',
  data: {
    academic_years: [], accounts: [], income_entries: [], expense_entries: [],
    transfers: [], recurring_templates: [], recoverables: [], recoverable_repayments: [],
  },
};

describe('finance backup validation', () => {
  it('accepts a structurally complete version 2 backup', () => {
    expect(parseFinanceBackup(emptyV2).version).toBe('2.0');
  });

  it('rejects a version 2 backup that silently omits recoverables', () => {
    const malformed = structuredClone(emptyV2);
    delete (malformed.data as Partial<typeof malformed.data>).recoverables;
    expect(() => parseFinanceBackup(malformed)).toThrow(/recoverables/);
  });

  it('rejects invalid monetary values before destructive restore begins', () => {
    const malformed = structuredClone(emptyV2);
    malformed.data.transfers.push({ amount: -1 } as never);
    expect(() => parseFinanceBackup(malformed)).toThrow(/transfers/);
  });
});
