import { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  Wallet,
} from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { StatCard } from '@/components/StatCard';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { cn } from '@/lib/utils';
import type { AccountType } from '@/types/finance';

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  school_bank: 'School Bank',
  personal_bank: 'Personal Bank',
  cash: 'Cash',
};

const ACCOUNT_TYPE_ICON = {
  school_bank: Landmark,
  personal_bank: Banknote,
  cash: Wallet,
};

export default function BankBalancesPage() {
  const {
    accounts,
    incomeEntries,
    expenseEntries,
    transfers,
    getAccountBalance,
    getTotalBalance,
  } = useFinanceStore();

  const accountRows = useMemo(() => {
    return accounts
      .filter((account) => !account.isArchived)
      .map((account) => {
        const income = incomeEntries
          .filter((entry) => entry.accountId === account.id)
          .reduce((sum, entry) => sum + entry.amount, 0);
        const expenses = expenseEntries
          .filter((entry) => entry.accountId === account.id)
          .reduce((sum, entry) => sum + entry.amount, 0);
        const transfersIn = transfers
          .filter((transfer) => transfer.toAccountId === account.id)
          .reduce((sum, transfer) => sum + transfer.amount, 0);
        const transfersOut = transfers
          .filter((transfer) => transfer.fromAccountId === account.id)
          .reduce((sum, transfer) => sum + transfer.amount, 0);

        return {
          ...account,
          income,
          expenses,
          transfersIn,
          transfersOut,
          balance: getAccountBalance(account.id),
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [accounts, incomeEntries, expenseEntries, transfers, getAccountBalance]);

  const totals = useMemo(() => {
    const totalBalance = getTotalBalance();
    const bankBalance = accountRows
      .filter((account) => account.type !== 'cash')
      .reduce((sum, account) => sum + account.balance, 0);
    const cashBalance = accountRows
      .filter((account) => account.type === 'cash')
      .reduce((sum, account) => sum + account.balance, 0);
    const schoolBalance = accountRows
      .filter((account) => account.type === 'school_bank')
      .reduce((sum, account) => sum + account.balance, 0);

    return { totalBalance, bankBalance, cashBalance, schoolBalance };
  }, [accountRows, getTotalBalance]);

  const recentMovements = useMemo(() => {
    const getAccountName = (accountId: string) =>
      accounts.find((account) => account.id === accountId)?.name || 'Unknown Account';

    const income = incomeEntries.map((entry) => ({
      id: `income-${entry.id}`,
      date: entry.date,
      title: entry.isLateCollection ? `Late Collection (${entry.category})` : entry.category,
      detail: getAccountName(entry.accountId),
      amount: entry.amount,
      direction: 'in' as const,
    }));

    const expenses = expenseEntries.map((entry) => ({
      id: `expense-${entry.id}`,
      date: entry.date,
      title: entry.category,
      detail: getAccountName(entry.accountId),
      amount: entry.amount,
      direction: 'out' as const,
    }));

    const transferRows = transfers.flatMap((transfer) => [
      {
        id: `transfer-out-${transfer.id}`,
        date: transfer.date,
        title: 'Transfer Out',
        detail: `${getAccountName(transfer.fromAccountId)} to ${getAccountName(transfer.toAccountId)}`,
        amount: transfer.amount,
        direction: 'transfer-out' as const,
      },
      {
        id: `transfer-in-${transfer.id}`,
        date: transfer.date,
        title: 'Transfer In',
        detail: `${getAccountName(transfer.fromAccountId)} to ${getAccountName(transfer.toAccountId)}`,
        amount: transfer.amount,
        direction: 'transfer-in' as const,
      },
    ]);

    return [...income, ...expenses, ...transferRows]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
  }, [accounts, incomeEntries, expenseEntries, transfers]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">Bank Balances</h1>
        <p className="text-fit text-sm text-muted-foreground">
          Current balances across all active school, personal, and cash accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="All Accounts"
          value={formatINRAbbr(totals.totalBalance)}
          fullValue={formatINR(totals.totalBalance)}
          icon={Landmark}
          variant="balance"
        />
        <StatCard
          title="Bank Total"
          value={formatINRAbbr(totals.bankBalance)}
          fullValue={formatINR(totals.bankBalance)}
          icon={Banknote}
          variant="profit"
        />
        <StatCard
          title="School Bank"
          value={formatINRAbbr(totals.schoolBalance)}
          fullValue={formatINR(totals.schoolBalance)}
          icon={Landmark}
          variant="income"
        />
        <StatCard
          title="Cash"
          value={formatINRAbbr(totals.cashBalance)}
          fullValue={formatINR(totals.cashBalance)}
          icon={Wallet}
          variant="pending"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Account Balance Check</h3>
          <span className="text-xs text-muted-foreground">{accountRows.length} active accounts</span>
        </div>

        {accountRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Landmark className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No active accounts found.</p>
          </div>
        ) : (
          <div className="divide-y">
            {accountRows.map((account) => {
              const Icon = ACCOUNT_TYPE_ICON[account.type];
              const movementTotal = account.income + account.transfersIn - account.expenses - account.transfersOut;

              return (
                <div key={account.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-fit text-sm font-semibold">{account.name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {ACCOUNT_TYPE_LABEL[account.type]}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:w-[560px]">
                      <BalancePart label="Opening" value={account.startingBalance} />
                      <BalancePart label="Net Movement" value={movementTotal} />
                      <div>
                        <p className="text-muted-foreground">Current Balance</p>
                        <p className={cn('money-fit font-mono text-base font-bold', account.balance >= 0 ? 'text-primary' : 'text-expense')}>
                          {formatINR(account.balance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                    <MiniMetric label="Income" value={account.income} tone="income" />
                    <MiniMetric label="Expenses" value={account.expenses} tone="expense" />
                    <MiniMetric label="Transfers In" value={account.transfersIn} tone="income" />
                    <MiniMetric label="Transfers Out" value={account.transfersOut} tone="expense" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Recent Balance Movements</h3>
        </div>

        {recentMovements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ArrowLeftRight className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No account movements yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {recentMovements.map((movement) => {
              const isPositive = movement.direction === 'in' || movement.direction === 'transfer-in';
              const Icon = movement.direction === 'in'
                ? ArrowDownLeft
                : movement.direction === 'out'
                  ? ArrowUpRight
                  : ArrowLeftRight;

              return (
                <div key={movement.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', isPositive ? 'bg-income/10' : 'bg-expense/10')}>
                    <Icon className={cn('h-4 w-4', isPositive ? 'text-income' : 'text-expense')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="text-fit">{movement.title}</span>
                      {movement.direction.startsWith('transfer') && <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
                    </div>
                    <p className="text-fit text-xs text-muted-foreground">
                      {movement.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' - '}
                      {movement.detail}
                    </p>
                  </div>
                  <span className={cn('money-fit max-w-[42%] text-right font-mono text-sm font-semibold', isPositive ? 'text-income' : 'text-expense')}>
                    {isPositive ? '+' : '-'}{formatINR(movement.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BalancePart({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={cn('money-fit font-mono text-sm font-semibold', value >= 0 ? 'text-foreground' : 'text-expense')}>
        {formatINR(value)}
      </p>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: number; tone: 'income' | 'expense' }) {
  return (
    <div className={cn('rounded-lg border p-3', tone === 'income' ? 'bg-income/5 border-income/15' : 'bg-expense/5 border-expense/15')}>
      <p className="text-muted-foreground">{label}</p>
      <p className={cn('money-fit mt-0.5 font-mono text-sm font-semibold', tone === 'income' ? 'text-income' : 'text-expense')}>
        {formatINR(value)}
      </p>
    </div>
  );
}
