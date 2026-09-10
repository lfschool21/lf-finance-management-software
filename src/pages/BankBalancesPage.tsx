import { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  Wallet,
} from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
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
  const { t } = useTranslation();
  const {
    accounts,
    incomeEntries,
    expenseEntries,
    transfers,
    recoverables,
    recoverableRepayments,
    getAccountBalance,
    getAccountNetMovement,
    getTotalBalance,
  } = useFinanceStore();

  const accountRows = useMemo(() => {
    return accounts
      .map((account) => {
        const movement = getAccountNetMovement(account.id);
        return {
          ...account,
          ...movement,
          balance: getAccountBalance(account.id),
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [accounts, incomeEntries, expenseEntries, transfers, recoverables, recoverableRepayments, getAccountBalance, getAccountNetMovement]);

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
      title: entry.isLateCollection ? 'Previous-Year Fee Payment' : entry.category,
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

    const transferRows = transfers.map((transfer) => ({
      id: `transfer-${transfer.id}`,
      date: transfer.date,
      title: 'Transfer',
      detail: `${getAccountName(transfer.fromAccountId)} → ${getAccountName(transfer.toAccountId)} · No change to total liquidity`,
      amount: transfer.amount,
      direction: 'transfer' as const,
    }));

    const advanceRows = recoverables.map((entry) => ({
      id: `advance-${entry.id}`,
      date: entry.dateGiven,
      title: `Recoverable Advance — ${entry.partyName}`,
      detail: `${getAccountName(entry.sourceAccountId)} · not an expense`,
      amount: entry.originalAmount,
      direction: 'recoverable-out' as const,
    }));

    const repaymentRows = recoverableRepayments.map((entry) => ({
      id: `recovery-${entry.id}`,
      date: entry.date,
      title: 'Recoverable Repayment',
      detail: `${getAccountName(entry.accountId)} · liquidity restored, not income`,
      amount: entry.amount,
      direction: 'recoverable-in' as const,
    }));

    return [...income, ...expenses, ...transferRows, ...advanceRows, ...repaymentRows]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
  }, [accounts, incomeEntries, expenseEntries, transfers, recoverables, recoverableRepayments]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('balancesTitle')}
        subtitle={t('balancesSubtitle')}
      />

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('totalLiquidBalance')}
          value={formatINRAbbr(totals.totalBalance)}
          fullValue={formatINR(totals.totalBalance)}
          icon={Landmark}
          variant="balance"
        />
        <StatCard
          title={t('bankTotal')}
          value={formatINRAbbr(totals.bankBalance)}
          fullValue={formatINR(totals.bankBalance)}
          icon={Banknote}
          variant="profit"
        />
        <StatCard
          title={t('schoolBank')}
          value={formatINRAbbr(totals.schoolBalance)}
          fullValue={formatINR(totals.schoolBalance)}
          icon={Landmark}
          variant="income"
        />
        <StatCard
          title={t('cash')}
          value={formatINRAbbr(totals.cashBalance)}
          fullValue={formatINR(totals.cashBalance)}
          icon={Wallet}
          variant="pending"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t('accountReconciliation')}</h3>
          <span className="text-xs text-muted-foreground">{t('trackedAccounts', { count: accountRows.length })}</span>
        </div>

        {accountRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Landmark className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t('noAccountsFound')}</p>
          </div>
        ) : (
          <div className="divide-y">
            {accountRows.map((account) => {
              const Icon = ACCOUNT_TYPE_ICON[account.type];
              const movementTotal = account.net;

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
                          {ACCOUNT_TYPE_LABEL[account.type]}{account.isArchived ? ' • Archived' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:w-[560px]">
                      <BalancePart label={t('opening')} value={account.startingBalance} />
                      <BalancePart label={t('netMovement')} value={movementTotal} />
                      <div>
                        <p className="text-muted-foreground">{t('currentBalance')}</p>
                        <p className={cn('money-fit font-mono text-base font-bold', account.balance >= 0 ? 'text-primary' : 'text-expense')}>
                          {formatINR(account.balance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <details className="group mt-3 rounded-lg border bg-muted/20">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('showReconciliationDetails')}</summary>
                    <div className="grid gap-2 border-t p-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
                      <MiniMetric label="Income" value={account.income} tone="income" />
                      <MiniMetric label="Expenses" value={account.expenses} tone="expense" />
                      <MiniMetric label="Transfers In" value={account.transfersIn} tone="neutral" />
                      <MiniMetric label="Transfers Out" value={account.transfersOut} tone="neutral" />
                      <MiniMetric label="Recoverable Advances" value={account.advancesGiven} tone="neutral" />
                      <MiniMetric label="Recoverable Repayments" value={account.recoveriesReceived} tone="neutral" />
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t('recentBalanceMovements')}</h3>
        </div>

        {recentMovements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ArrowLeftRight className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t('noAccountMovementsYet')}</p>
          </div>
        ) : (
          <div className="divide-y">
            {recentMovements.map((movement) => {
              const isPositive = movement.direction === 'in';
              const isTransfer = movement.direction === 'transfer';
              const isRecoverable = movement.direction.startsWith('recoverable');
              const Icon = movement.direction === 'in'
                ? ArrowDownLeft
                : movement.direction === 'out' || movement.direction === 'recoverable-out'
                  ? ArrowUpRight
                  : ArrowLeftRight;

              return (
                <div key={movement.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', isTransfer || isRecoverable ? 'bg-primary/10' : isPositive ? 'bg-income/10' : 'bg-expense/10')}>
                    <Icon className={cn('h-4 w-4', isTransfer || isRecoverable ? 'text-primary' : isPositive ? 'text-income' : 'text-expense')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="text-fit">{movement.title}</span>
                    </div>
                    <p className="text-fit text-xs text-muted-foreground">
                      {movement.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' - '}
                      {movement.detail}
                    </p>
                  </div>
                  <span className={cn('money-fit max-w-[42%] text-right font-mono text-sm font-semibold', isTransfer || isRecoverable ? 'text-primary' : isPositive ? 'text-income' : 'text-expense')}>
                    {isTransfer ? '' : movement.direction === 'in' || movement.direction === 'recoverable-in' ? '+' : '-'}{formatINR(movement.amount)}
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

function MiniMetric({ label, value, tone }: { label: string; value: number; tone: 'income' | 'expense' | 'neutral' }) {
  return (
    <div className={cn('rounded-lg border p-3', tone === 'income' ? 'bg-income/5 border-income/15' : tone === 'expense' ? 'bg-expense/5 border-expense/15' : 'bg-primary/5 border-primary/15')}>
      <p className="text-muted-foreground">{label}</p>
      <p className={cn('money-fit mt-0.5 font-mono text-sm font-semibold', tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-primary')}>
        {formatINR(value)}
      </p>
    </div>
  );
}
