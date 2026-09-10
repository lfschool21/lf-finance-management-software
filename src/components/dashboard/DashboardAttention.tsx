import React from 'react';
import { AlertTriangle, ChevronRight, ClipboardList, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';

interface DashboardAttentionProps {
  lastYearPending: number;
  recoverablesOutstanding: number;
  pendingRecurringCount: number;
  onViewStudentFees: () => void;
  onViewRecoverables: () => void;
  onReviewRecurring: () => void;
}

export function DashboardAttention({
  lastYearPending,
  recoverablesOutstanding,
  pendingRecurringCount,
  onViewStudentFees,
  onViewRecoverables,
  onReviewRecurring,
}: DashboardAttentionProps) {
  const { t } = useTranslation();

  const attentionCount =
    Number(lastYearPending > 0) +
    Number(recoverablesOutstanding > 0) +
    Number(pendingRecurringCount > 0);

  return (
    <section
      className="rounded-xl border border-border/90 bg-card shadow-sm overflow-hidden"
      aria-labelledby="dashboard-attention-heading"
    >
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-muted/20 sm:px-5">
        <div className="flex items-center gap-2">
          <h2 id="dashboard-attention-heading" className="text-sm font-semibold text-foreground">
            {t('needsAttention')}
          </h2>
          {attentionCount > 0 && (
            <Badge variant="secondary" className="bg-warning/15 text-warning-foreground font-semibold px-2 py-0 text-xs font-mono font-mono-nums">
              {attentionCount}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block">
          {attentionCount === 0 ? t('noPendingAlerts') : t('actionRequired')}
        </p>
      </div>

      {attentionCount === 0 ? (
        <div className="px-4 py-3 text-xs sm:text-sm text-muted-foreground sm:px-5">
          {t('everythingUpToDate')}
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {lastYearPending > 0 && (
            <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('prevYearFeesPending')}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono font-mono-nums">
                    {formatINR(lastYearPending)} {t('stillOutstanding')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 justify-start text-xs font-semibold text-primary hover:bg-primary/5 sm:justify-center"
                onClick={onViewStudentFees}
              >
                <span>{t('viewStudentFees')}</span>
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {recoverablesOutstanding > 0 && (
            <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <HandCoins className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('recoverablesOutstanding')}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono font-mono-nums">
                    {formatINR(recoverablesOutstanding)} {t('tempAdvances')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 justify-start text-xs font-semibold text-primary hover:bg-primary/5 sm:justify-center"
                onClick={onViewRecoverables}
              >
                <span>{t('reviewRecoverables')}</span>
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {pendingRecurringCount > 0 && (
            <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('recurringExpensesReview')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('recurringItemsNeedReview', { count: pendingRecurringCount, plural: pendingRecurringCount === 1 ? '' : 's' })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 justify-start text-xs font-semibold text-primary hover:bg-primary/5 sm:justify-center"
                onClick={onReviewRecurring}
              >
                <span>{t('reviewItems')}</span>
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
