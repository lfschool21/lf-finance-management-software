import { useMemo } from 'react';
import { ArrowLeftRight, Plus, ArrowRight } from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACCOUNT_TYPE_ICON: Record<string, string> = {
  school_bank: '🏫',
  personal_bank: '👤',
  cash: '💵',
};

export default function TransfersPage() {
  const { accounts, transfers, incomeEntries, expenseEntries } = useFinanceStore();

  const accountBalances = useMemo(() => {
    return accounts.filter((a) => !a.isArchived).map((acc) => {
      const inflow = incomeEntries
        .filter((i) => i.accountId === acc.id)
        .reduce((s, i) => s + i.amount, 0);
      const outflow = expenseEntries
        .filter((e) => e.accountId === acc.id)
        .reduce((s, e) => s + e.amount, 0);
      const transfersIn = transfers
        .filter((t) => t.toAccountId === acc.id)
        .reduce((s, t) => s + t.amount, 0);
      const transfersOut = transfers
        .filter((t) => t.fromAccountId === acc.id)
        .reduce((s, t) => s + t.amount, 0);
      const balance = acc.startingBalance + inflow - outflow + transfersIn - transfersOut;
      return { ...acc, balance };
    });
  }, [accounts, incomeEntries, expenseEntries, transfers]);

  const sortedTransfers = [...transfers].sort((a, b) => b.date.getTime() - a.date.getTime());

  const getAccountName = (id: string) => accounts.find((a) => a.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transfers & Accounts</h1>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          Transfer Money
        </Button>
      </div>

      {/* Account Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accountBalances.map((acc) => (
          <div key={acc.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{ACCOUNT_TYPE_ICON[acc.type]}</span>
              <div>
                <p className="text-sm font-semibold">{acc.name}</p>
                <p className="text-[10px] uppercase text-muted-foreground">
                  {acc.type.replace('_', ' ')}
                </p>
              </div>
            </div>
            <p className={cn('mt-3 font-mono text-xl font-bold', acc.balance >= 0 ? 'text-primary' : 'text-expense')}>
              {formatINR(acc.balance)}
            </p>
          </div>
        ))}
      </div>

      {/* Transfer History */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Transfer History</h3>
        {sortedTransfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-12">
            <ArrowLeftRight className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No transfers yet.</p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {sortedTransfers.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <ArrowLeftRight className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{getAccountName(t.fromAccountId)}</span>
                    <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate">{getAccountName(t.toAccountId)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {t.notes && ` • ${t.notes}`}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold">{formatINR(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
