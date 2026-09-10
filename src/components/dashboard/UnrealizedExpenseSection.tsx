import React from 'react';
import { AlertCircle, HelpCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UnrealizedExpenseSectionProps {
  totalFeesCollected: number;
  availableBalance: number;
  recordedSchoolExpenses: number;
  unrealizedExpenses: number;
  onAddExpense: () => void;
}

export function UnrealizedExpenseSection({
  totalFeesCollected,
  availableBalance,
  recordedSchoolExpenses,
  unrealizedExpenses,
  onAddExpense,
}: UnrealizedExpenseSectionProps) {
  const { t } = useTranslation();
  const hasUnrealizedExpenses = unrealizedExpenses > 0;

  return (
    <section
      aria-labelledby="unrealized-expense-title"
      className="rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 id="unrealized-expense-title" className="text-lg font-bold text-foreground">
            {t('unrealizedExpenses')}
          </h2>
          <Badge
            variant="secondary"
            className={
              hasUnrealizedExpenses
                ? 'bg-warning/15 text-warning-foreground font-semibold text-xs'
                : 'bg-muted text-muted-foreground font-medium text-xs'
            }
          >
            {hasUnrealizedExpenses ? t('unrecordedSpendingBadge') : t('reconciledBadge')}
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Unrealized expenses explanation">
                  <HelpCircle className="h-4 w-4 text-muted-foreground/70" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t('unrealizedTooltip')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('unrealizedExpensesSubtitle')}
        </p>
      </div>

      {/* Metric Breakdown Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {/* 1. Total Fees Collected (Supposed to have) */}
        <div className="rounded-lg bg-muted/30 border border-border/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('totalFeesCollectedLabel')}
          </p>
          <p
            className="mt-1 font-mono text-lg font-bold text-income font-mono-nums"
            title={formatINR(totalFeesCollected)}
          >
            {formatINR(totalFeesCollected)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('supposedToHaveFromFees')}
          </p>
        </div>

        {/* 2. Available Balance */}
        <div className="rounded-lg bg-muted/30 border border-border/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('currentAvailableBalanceLabel')}
          </p>
          <p
            className="mt-1 font-mono text-lg font-bold text-foreground font-mono-nums"
            title={formatINR(availableBalance)}
          >
            {formatINR(availableBalance)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('currentlyOnHandInAccounts')}
          </p>
        </div>

        {/* 3. Recorded Expenses */}
        <div className="rounded-lg bg-muted/30 border border-border/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('recordedSchoolExpensesLabel')}
          </p>
          <p
            className="mt-1 font-mono text-lg font-bold text-expense font-mono-nums"
            title={formatINR(recordedSchoolExpenses)}
          >
            {formatINR(recordedSchoolExpenses)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('vouchersAlreadyLogged')}
          </p>
        </div>

        {/* 4. Unrealized Expense (The Gap) */}
        <div className="rounded-lg bg-warning/[0.06] border border-warning/30 p-3">
          <p className="text-xs font-semibold text-warning">
            {t('unrealizedExpenseLabel')}
          </p>
          <p
            className="mt-1 font-mono text-xl font-bold text-warning font-mono-nums"
            title={formatINR(unrealizedExpenses)}
          >
            {formatINR(unrealizedExpenses)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {hasUnrealizedExpenses ? t('unloggedOperatingExpenses') : t('noUnrecordedExpenseGap')}
          </p>
        </div>
      </div>

      {/* Explanatory and Action Footer */}
      {hasUnrealizedExpenses ? (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/60">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span>
              {t('unrealizedNarrative', {
                totalFees: formatINR(totalFeesCollected),
                balance: formatINR(availableBalance),
                unrealized: formatINR(unrealizedExpenses),
              })}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 border-warning/40 text-warning hover:bg-warning/10 font-semibold text-xs"
            onClick={onAddExpense}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('addExpenseVoucher')}</span>
          </Button>
        </div>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground pt-2 border-t border-border/40">
          {t('allFeesAccountedFor')}
        </div>
      )}
    </section>
  );
}
