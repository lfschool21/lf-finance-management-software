import { useState, useMemo } from 'react';
import { ArrowLeftRight, Plus, ArrowRight, Landmark, Banknote, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useFinanceStore } from '@/store/finance-store';
import { useTranslation } from '@/lib/i18n';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TransferModal } from '@/components/TransferModal';
import type { Transfer } from '@/types/finance';
import { Link } from 'react-router-dom';

const ACCOUNT_TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  school_bank: Landmark,
  personal_bank: Banknote,
  cash: Wallet,
};

export default function TransfersPage() {
  const { t } = useTranslation();
  const { accounts, transfers, incomeEntries, expenseEntries, recoverables, recoverableRepayments, getAccountBalance } = useFinanceStore();
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<Transfer | undefined>();

  const accountBalances = useMemo(() => {
    return accounts.filter((a) => !a.isArchived).map((acc) => ({
      ...acc,
      balance: getAccountBalance(acc.id),
    }));
  }, [accounts, incomeEntries, expenseEntries, transfers, recoverables, recoverableRepayments, getAccountBalance]);

  const sortedTransfers = [...transfers].sort((a, b) => b.date.getTime() - a.date.getTime());

  const getAccountName = (id: string) => accounts.find((a) => a.id === id)?.name || 'Unknown';

  function openAdd() {
    setEditEntry(undefined);
    setShowModal(true);
  }

  function openEdit(entry: Transfer) {
    setEditEntry(entry);
    setShowModal(true);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('transfersAndAccounts')}
        subtitle={t('transfersSubtitle')}
        action={
          <Button className="w-full gap-1.5 sm:w-auto" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('transferMoney')}
          </Button>
        }
      />

      <div className="grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-full flex items-center justify-between"><h2 className="text-sm font-semibold">{t('activeAccountBalances')}</h2><Link className="text-xs text-primary hover:underline" to="/balances">{t('viewFullReconciliation')}</Link></div>
        {accountBalances.map((acc) => (
          <div key={acc.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{(() => { const Icon = ACCOUNT_TYPE_ICON[acc.type] || Wallet; return <Icon className="h-5 w-5 text-primary" />; })()}</span>
              <div>
                <p className="text-fit text-sm font-semibold">{acc.name}</p>
                <p className="text-[10px] uppercase text-muted-foreground">
                  {acc.type.replace('_', ' ')}
                </p>
              </div>
            </div>
            <p className={cn('money-fit mt-3 font-mono text-xl font-bold', acc.balance >= 0 ? 'text-primary' : 'text-expense')}>
              {formatINR(acc.balance)}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('transferHistory')}</h3>
        {sortedTransfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-12">
            <ArrowLeftRight className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t('noTransfersYet')}</p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {sortedTransfers.map((t) => (
              <button
                type="button"
                key={t.id}
                className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => openEdit(t)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <ArrowLeftRight className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="text-fit">{getAccountName(t.fromAccountId)}</span>
                    <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="text-fit">{getAccountName(t.toAccountId)}</span>
                  </div>
                  <p className="text-fit text-xs text-muted-foreground">
                    {t.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {t.notes && ` • ${t.notes}`}
                  </p>
                </div>
                <span className="money-fit max-w-[42%] text-right font-mono text-sm font-semibold">{formatINR(t.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <TransferModal isOpen={showModal} onClose={() => setShowModal(false)} editEntry={editEntry} />
    </div>
  );
}
