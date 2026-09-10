import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';
import type { AcademicYear } from '@/types/finance';
import type { YearPendingInfo } from '@/store/finance-store';

interface PreviousYearRow {
  year: AcademicYear;
  info: YearPendingInfo;
  receivedThisAcademicYear: number;
}

interface FeeCollectionOverviewProps {
  currentYearLabel?: string;
  currentTarget: number;
  currentCollected: number;
  currentRemaining: number;
  feeProgress: number;
  lastYearPending: number;
  lastYearReceived: number;
  previousYearRows: PreviousYearRow[];
  totalRosterLastYearPending: number;
  totalFeesReceivedThisAY: number;
  totalFeesStillToCollect: number;
  onViewStudentFees: () => void;
}

export function FeeCollectionOverview({
  currentYearLabel,
  currentTarget,
  currentCollected,
  currentRemaining,
  feeProgress,
  lastYearPending,
  lastYearReceived,
  previousYearRows,
  totalRosterLastYearPending,
  totalFeesReceivedThisAY,
  totalFeesStillToCollect,
  onViewStudentFees,
}: FeeCollectionOverviewProps) {
  const { t } = useTranslation();
  const [showPriorBreakdown, setShowPriorBreakdown] = useState(false);

  const activePriorRows = previousYearRows.filter(
    (row) => row.info.remaining > 0 || row.receivedThisAcademicYear > 0
  );

  return (
    <section
      className="rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5"
      aria-labelledby="fee-collection-title"
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="fee-collection-title" className="text-lg font-bold text-foreground">
            {t('feeCollection')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('feeCollectionSubtitle')}
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground w-fit font-mono-nums">
          AY {currentYearLabel || '—'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Current-Year Tuition Card */}
        <div className="rounded-xl bg-primary/[0.03] border border-primary/10 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('currentYearTuition')}</h3>
              <span className="text-xs font-mono font-semibold text-primary font-mono-nums">
                {feeProgress}%
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('collectedSoFar')}</p>
                <p
                  className="mt-0.5 font-mono text-xl font-bold text-income font-mono-nums"
                  title={formatINR(currentCollected)}
                >
                  {formatINRAbbr(currentCollected)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t('target')}</p>
                <p
                  className="mt-0.5 font-mono text-sm font-semibold text-foreground font-mono-nums"
                  title={formatINR(currentTarget)}
                >
                  {formatINR(currentTarget)}
                </p>
              </div>
            </div>

            <Progress value={feeProgress} className="mt-3 h-2.5" />

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('remainingToReachTarget')}</span>
              <div className="flex items-baseline gap-1 font-mono font-bold text-warning font-mono-nums text-sm">
                <span title={formatINR(currentRemaining)}>{formatINR(currentRemaining)}</span>
                <span className="text-xs font-medium text-muted-foreground">{t('remainingWord')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Last Year's Pending Fees Card */}
        <div className="rounded-xl bg-warning/[0.03] border border-warning/20 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('lastYearsPendingFees')}</h3>
              {lastYearPending === 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-income">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t('fullyCleared')}
                </span>
              ) : (
                <span className="text-xs font-mono font-semibold text-warning font-mono-nums">
                  {t('pendingDues')}
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{t('receivedThisAY')}</p>
                <p
                  className="mt-0.5 font-mono text-xl font-bold text-income font-mono-nums"
                  title={formatINR(lastYearReceived)}
                >
                  {formatINRAbbr(lastYearReceived)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('stillPending')}</p>
                <p
                  className="mt-0.5 font-mono text-xl font-bold text-warning font-mono-nums"
                  title={formatINR(lastYearPending)}
                >
                  {formatINRAbbr(lastYearPending)}
                </p>
              </div>
            </div>

            {/* Drilldown details for prior years */}
            {activePriorRows.length > 0 ? (
              <div className="mt-3 border-t border-warning/15 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPriorBreakdown((prev) => !prev)}
                  className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1"
                >
                  <span>
                    {t('academicYearsWithPending', {
                      count: activePriorRows.length,
                      plural: activePriorRows.length > 1 ? 's' : '',
                    })}
                  </span>
                  {showPriorBreakdown ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showPriorBreakdown && (
                  <div className="mt-2 space-y-1.5 pl-1">
                    {activePriorRows.map((row) => (
                      <div
                        key={row.year.id}
                        className="flex items-center justify-between text-xs py-0.5 border-b border-warning/10 last:border-0"
                      >
                        <span className="font-medium text-foreground">AY {row.year.label}</span>
                        <span className="font-mono text-muted-foreground font-mono-nums">
                          {formatINR(row.info.remaining)} {t('remainingWord')}
                          {row.receivedThisAcademicYear > 0 ? ` · ${formatINR(row.receivedThisAcademicYear)} received` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : totalRosterLastYearPending > 0 ? (
              <div className="mt-3 border-t border-warning/15 pt-2 text-xs">
                <span className="font-medium text-foreground">{t('studentCarriedForwardDues')}: </span>
                <span className="font-mono text-muted-foreground font-mono-nums">
                  {formatINR(totalRosterLastYearPending)} {t('remainingWord')}
                </span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                {t('noLastYearPending')}
              </p>
            )}
          </div>

          <div className="mt-3 pt-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs font-semibold text-warning hover:text-warning/80"
              onClick={onViewStudentFees}
            >
              <span>{t('viewStudentFees')}</span>
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Aggregate bottom metrics: explicit unambiguous labels */}
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border/70 pt-4 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('tuitionFeesReceivedThisAY')}
          </p>
          <p
            className="mt-1 font-mono text-xl font-bold text-income font-mono-nums"
            title={formatINR(totalFeesReceivedThisAY)}
          >
            {formatINR(totalFeesReceivedThisAY)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('tuitionFeesReceivedSubtitle', {
              current: formatINRAbbr(currentCollected),
              prior: formatINRAbbr(lastYearReceived),
            })}
          </p>
        </div>

        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('totalFeesStillToCollect')}
          </p>
          <p
            className="mt-1 font-mono text-xl font-bold text-warning font-mono-nums"
            title={formatINR(totalFeesStillToCollect)}
          >
            {formatINR(totalFeesStillToCollect)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('totalFeesStillToCollectSubtitle', {
              current: formatINRAbbr(currentRemaining),
              prior: formatINRAbbr(lastYearPending),
            })}
          </p>
        </div>
      </div>
    </section>
  );
}
