import React from 'react';
import {
  ArrowLeftRight,
  HandCoins,
  IndianRupee,
  School,
  TrendingUp,
} from 'lucide-react';
import { formatINR } from '@/utils/currency';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export interface DashboardTransaction {
  id: string;
  date: Date;
  label: string;
  detail?: string;
  amount: number;
  kind: 'income' | 'expense' | 'transfer' | 'recoverable';
}

interface RecentActivityProps {
  transactions: DashboardTransaction[];
}

export function RecentActivity({ transactions }: RecentActivityProps) {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden"
      aria-labelledby="recent-activity-heading"
    >
      <div className="border-b border-border/70 px-4 py-3 bg-muted/20 sm:px-5 flex items-center justify-between">
        <div>
          <h2 id="recent-activity-heading" className="text-sm font-bold text-foreground">
            {t('recentActivityAcrossAccounts')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('recentActivitySubtitle')}
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
          <IndianRupee className="mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('noTransactionsRecorded')}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {transactions.map((tx) => {
            const Icon =
              tx.kind === 'income'
                ? TrendingUp
                : tx.kind === 'expense'
                ? School
                : tx.kind === 'transfer'
                ? ArrowLeftRight
                : HandCoins;

            const iconStyles =
              tx.kind === 'income'
                ? 'bg-income/10 text-income'
                : tx.kind === 'expense'
                ? 'bg-expense/10 text-expense'
                : tx.kind === 'transfer'
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground';

            const amountStyles =
              tx.kind === 'income'
                ? 'text-income'
                : tx.kind === 'expense'
                ? 'text-expense'
                : 'text-foreground';

            const sign =
              tx.kind === 'income'
                ? '+'
                : tx.kind === 'expense'
                ? '−'
                : '';

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconStyles)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {tx.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tx.date.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {tx.detail ? ` · ${tx.detail}` : ''}
                    </p>
                  </div>
                </div>

                <span
                  className={cn(
                    'font-mono text-sm font-semibold shrink-0 text-right whitespace-nowrap font-mono-nums',
                    amountStyles
                  )}
                  title={formatINR(tx.amount)}
                >
                  {sign}{formatINR(tx.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
