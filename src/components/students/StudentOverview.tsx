import React from 'react';
import { Users, AlertCircle, Clock, IndianRupee, CheckCircle2, ArrowRight, Wallet, Calculator } from 'lucide-react';
import { formatINR } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import type { ClassRosterSummary, RosterSummary } from '@/lib/student-fees';
import type { AcademicYear } from '@/types/finance';
import type { StudentMedium } from '@/types/students';

export interface MediumCollectionStats {
  studentsCount: number;
  totalAnnualFee: number;
  totalObligation: number;
  collected: number;
  currentPending: number;
  previousPending: number;
  totalPending: number;
  collectionPercent: number;
  avgAnnualFeeCharged?: number;
  avgCollected?: number;
}

interface StudentOverviewProps {
  totalStudents?: number;
  currentYearPending?: number;
  previousYearPending?: number;
  totalPending?: number;
  activeMedium?: 'all' | StudentMedium;
  activeCollected?: number;
  onMediumChange?: (medium: StudentMedium) => void;
  gujaratiStats?: MediumCollectionStats;
  englishStats?: MediumCollectionStats;
  onOpenCalculator?: () => void;
  avgAnnualFeeCharged?: number;
  avgCollected?: number;
  // Optional legacy props for backwards-compatibility
  summary?: RosterSummary;
  classes?: ClassRosterSummary[];
  year?: AcademicYear;
  unassignedTuition?: number;
}

export function StudentOverview({
  totalStudents,
  currentYearPending,
  previousYearPending,
  totalPending,
  activeMedium = 'gujarati',
  activeCollected,
  onMediumChange,
  gujaratiStats,
  englishStats,
  onOpenCalculator,
  avgAnnualFeeCharged,
  avgCollected,
  summary,
  unassignedTuition = 0,
}: StudentOverviewProps) {
  const { t } = useTranslation();

  const count = totalStudents ?? summary?.totalStudents ?? 0;
  const currentPending = currentYearPending ?? summary?.pending ?? 0;
  const prevPending = previousYearPending ?? 0;
  const totalDue = totalPending ?? (currentPending + prevPending);

  const isGujarati = activeMedium === 'gujarati';
  const isEnglish = activeMedium === 'english';

  const gujStats: MediumCollectionStats = gujaratiStats ?? {
    studentsCount: isGujarati ? count : 0,
    totalAnnualFee: 0,
    totalObligation: 0,
    collected: isGujarati ? (activeCollected ?? summary?.collected ?? 0) : 0,
    currentPending: isGujarati ? currentPending : 0,
    previousPending: isGujarati ? prevPending : 0,
    totalPending: isGujarati ? totalDue : 0,
    collectionPercent: 0,
  };

  const engStats: MediumCollectionStats = englishStats ?? {
    studentsCount: isEnglish ? count : 0,
    totalAnnualFee: 0,
    totalObligation: 0,
    collected: isEnglish ? (activeCollected ?? summary?.collected ?? 0) : 0,
    currentPending: isEnglish ? currentPending : 0,
    previousPending: isEnglish ? prevPending : 0,
    totalPending: isEnglish ? totalDue : 0,
    collectionPercent: 0,
  };

  const effectiveCollected =
    activeCollected ??
    summary?.collected ??
    (isGujarati ? gujStats.collected : engStats.collected);

  const activeTarget = isGujarati ? gujStats.totalAnnualFee : engStats.totalAnnualFee;
  const activePct =
    activeTarget > 0 ? Math.min(100, Math.round((effectiveCollected / activeTarget) * 100)) : 0;

  const totalCombinedCollected = gujStats.collected + engStats.collected + unassignedTuition;

  const mediumLabel = isGujarati
    ? t('gujaratiMediumSummary') || 'Gujarati Medium Summary'
    : isEnglish
    ? t('englishMediumSummary') || 'English Medium Summary'
    : 'Medium Summary';

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-5">
      {/* 1. Medium Fee Collections Comparison Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-border/70 text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-income/10 text-income">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-foreground">
                Medium Fee Collection Breakdown
              </span>
              <p className="text-[11px] text-muted-foreground">
                Total fees collected for Gujarati and English medium students
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-lg bg-muted/60 border text-xs font-mono-nums">
            <span className="text-muted-foreground">Combined Collected:</span>
            <span className="font-bold text-income">{formatINR(totalCombinedCollected)}</span>
            {unassignedTuition > 0 && (
              <span className="text-[10px] text-muted-foreground ml-1" title="Includes unassigned general tuition payments">
                (incl. {formatINR(unassignedTuition)} unassigned)
              </span>
            )}
          </div>
        </div>

        {/* Dual Medium Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Gujarati Medium Fee Collection Card */}
          <div
            onClick={() => onMediumChange?.('gujarati')}
            role="button"
            tabIndex={0}
            aria-label="Gujarati Medium Fee Collection Summary"
            data-testid="gujarati-collection-summary"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onMediumChange?.('gujarati');
              }
            }}
            className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer overflow-hidden ${
              isGujarati
                ? 'bg-gradient-to-br from-amber-500/10 via-card to-card border-amber-500/60 shadow-sm ring-2 ring-amber-500/30'
                : 'bg-card hover:bg-muted/40 border-border/70 hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
                <span className="font-bold text-sm text-foreground">
                  Gujarati Medium
                </span>
                <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted/70 font-mono-nums font-medium">
                  {gujStats.studentsCount} {gujStats.studentsCount === 1 ? 'Student' : 'Students'}
                </span>
              </div>
              {isGujarati ? (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                  Active View
                </span>
              ) : (
                <span className="text-xs font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-primary">
                  Switch <ArrowRight className="h-3 w-3" />
                </span>
              )}
            </div>

            <div className="mt-3.5 flex items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total Fees Collected
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-income font-mono-nums">
                    {formatINR(gujStats.collected)}
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-income shrink-0 self-center" />
                </div>
              </div>
              <div className="text-right font-mono-nums">
                <span className="text-xs text-muted-foreground block">
                  Pending: <strong className="text-warning font-semibold">{formatINR(gujStats.totalPending)}</strong>
                </span>
                {gujStats.totalAnnualFee > 0 && (
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Target: {formatINR(gujStats.totalAnnualFee)}
                  </span>
                )}
              </div>
            </div>

            {/* Progress Bar & Subtext */}
            <div className="mt-3 space-y-1.5">
              <div className="h-2 w-full rounded-full bg-muted/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-income transition-all duration-500"
                  style={{ width: `${Math.min(100, gujStats.collectionPercent)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-muted-foreground font-mono-nums">
                <span className="font-semibold text-foreground">{gujStats.collectionPercent}% collected</span>
                <span>{formatINR(gujStats.collected)} of {formatINR(gujStats.totalAnnualFee || gujStats.collected)}</span>
              </div>
            </div>

            {gujStats.studentsCount > 0 && gujStats.totalAnnualFee > 0 && (
              <div className="mt-2.5 pt-2 border-t border-amber-500/20 flex items-center justify-between text-[11px] font-mono-nums text-muted-foreground">
                <span>Avg Fee Charged: <strong className="text-foreground">{formatINR(Math.round(gujStats.totalAnnualFee / gujStats.studentsCount))}</strong> / stu</span>
                <span>Avg Recvd: <strong className="text-income">{formatINR(Math.round(gujStats.collected / gujStats.studentsCount))}</strong></span>
              </div>
            )}
          </div>

          {/* English Medium Fee Collection Card */}
          <div
            onClick={() => onMediumChange?.('english')}
            role="button"
            tabIndex={0}
            aria-label="English Medium Fee Collection Summary"
            data-testid="english-collection-summary"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onMediumChange?.('english');
              }
            }}
            className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer overflow-hidden ${
              isEnglish
                ? 'bg-gradient-to-br from-sky-500/10 via-card to-card border-sky-500/60 shadow-sm ring-2 ring-sky-500/30'
                : 'bg-card hover:bg-muted/40 border-border/70 hover:border-sky-500/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500 ring-2 ring-sky-500/20" />
                <span className="font-bold text-sm text-foreground">
                  English Medium
                </span>
                <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted/70 font-mono-nums font-medium">
                  {engStats.studentsCount} {engStats.studentsCount === 1 ? 'Student' : 'Students'}
                </span>
              </div>
              {isEnglish ? (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-900 dark:text-sky-200 border border-sky-500/30">
                  Active View
                </span>
              ) : (
                <span className="text-xs font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-primary">
                  Switch <ArrowRight className="h-3 w-3" />
                </span>
              )}
            </div>

            <div className="mt-3.5 flex items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total Fees Collected
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-income font-mono-nums">
                    {formatINR(engStats.collected)}
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-income shrink-0 self-center" />
                </div>
              </div>
              <div className="text-right font-mono-nums">
                <span className="text-xs text-muted-foreground block">
                  Pending: <strong className="text-warning font-semibold">{formatINR(engStats.totalPending)}</strong>
                </span>
                {engStats.totalAnnualFee > 0 && (
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Target: {formatINR(engStats.totalAnnualFee)}
                  </span>
                )}
              </div>
            </div>

            {/* Progress Bar & Subtext */}
            <div className="mt-3 space-y-1.5">
              <div className="h-2 w-full rounded-full bg-muted/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-income transition-all duration-500"
                  style={{ width: `${Math.min(100, engStats.collectionPercent)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-muted-foreground font-mono-nums">
                <span className="font-semibold text-foreground">{engStats.collectionPercent}% collected</span>
                <span>{formatINR(engStats.collected)} of {formatINR(engStats.totalAnnualFee || engStats.collected)}</span>
              </div>
            </div>

            {engStats.studentsCount > 0 && engStats.totalAnnualFee > 0 && (
              <div className="mt-2.5 pt-2 border-t border-sky-500/20 flex items-center justify-between text-[11px] font-mono-nums text-muted-foreground">
                <span>Avg Fee Charged: <strong className="text-foreground">{formatINR(Math.round(engStats.totalAnnualFee / engStats.studentsCount))}</strong> / stu</span>
                <span>Avg Recvd: <strong className="text-income">{formatINR(Math.round(engStats.collected / engStats.studentsCount))}</strong></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Active Medium Operational KPIs (6 Detailed Metrics) */}
      <div className="space-y-3 pt-3 border-t border-border/70">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isGujarati ? 'bg-amber-500 ring-2 ring-amber-500/20' : 'bg-sky-500 ring-2 ring-sky-500/20'
              }`}
            />
            <span className="font-semibold text-sm text-foreground">
              {mediumLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Active workspace operational breakdown
            </span>
            {onOpenCalculator && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenCalculator}
                className="h-7 text-xs gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/10 shadow-xs"
              >
                <Calculator className="h-3.5 w-3.5" />
                <span>Calculate Avg Fees</span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5 font-mono-nums">
          {/* 1. Students Count */}
          <div className="rounded-lg bg-muted/40 border border-border/60 p-3.5 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                {isGujarati ? 'Gujarati Students' : isEnglish ? 'English Students' : 'Students'}
              </span>
              <Users className="h-4 w-4 opacity-70" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {count}
              </span>
              <span className="text-xs font-sans text-muted-foreground">enrolled</span>
            </div>
          </div>

          {/* 2. Fees Collected */}
          <div className="rounded-lg bg-income/10 border border-income/25 p-3.5 flex flex-col justify-between text-income hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider opacity-90">
                Fees Collected
              </span>
              <CheckCircle2 className="h-4 w-4 opacity-80" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tracking-tight">
                {formatINR(effectiveCollected)}
              </span>
              {activePct > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-income/20 text-income border border-income/30">
                  {activePct}%
                </span>
              )}
            </div>
          </div>

          {/* 3. Avg Fee Charged by School */}
          <div className="rounded-lg bg-primary/[0.06] border border-primary/20 p-3.5 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-primary">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                Avg Fee Charged
              </span>
              <Calculator className="h-4 w-4 opacity-80" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {formatINR(
                  count > 0 && activeTarget > 0
                    ? Math.round(activeTarget / count)
                    : isGujarati
                    ? (gujStats.avgAnnualFeeCharged ?? avgAnnualFeeCharged ?? 0)
                    : (engStats.avgAnnualFeeCharged ?? avgAnnualFeeCharged ?? 0)
                )}
              </span>
              <span className="text-[11px] font-sans text-muted-foreground">/ stu</span>
            </div>
          </div>

          {/* 4. This Year Pending */}
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3.5 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                This Year Pending
              </span>
              <IndianRupee className="h-4 w-4 opacity-70" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {formatINR(currentPending)}
              </span>
            </div>
          </div>

          {/* 5. Previous Year Pending */}
          <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3.5 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-orange-800 dark:text-orange-300">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                Previous Year Pending
              </span>
              <Clock className="h-4 w-4 opacity-70" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
                {formatINR(prevPending)}
              </span>
              {prevPending > 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                  Old Dues
                </span>
              )}
            </div>
          </div>

          {/* 6. Total Pending */}
          <div className="col-span-2 sm:col-span-1 rounded-lg bg-rose-500/5 border border-rose-500/25 p-3.5 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-rose-800 dark:text-rose-300">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                Total Pending
              </span>
              <AlertCircle className="h-4 w-4 opacity-70" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {formatINR(totalDue)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
