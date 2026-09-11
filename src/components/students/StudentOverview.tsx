import React from 'react';
import { Users, AlertCircle, Clock, IndianRupee } from 'lucide-react';
import { formatINR } from '@/utils/currency';
import { useTranslation } from '@/lib/i18n';
import type { ClassRosterSummary, RosterSummary } from '@/lib/student-fees';
import type { AcademicYear } from '@/types/finance';
import type { StudentMedium } from '@/types/students';

interface StudentOverviewProps {
  totalStudents?: number;
  currentYearPending?: number;
  previousYearPending?: number;
  totalPending?: number;
  activeMedium?: 'all' | StudentMedium;
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
  summary,
}: StudentOverviewProps) {
  const { t } = useTranslation();

  const count = totalStudents ?? summary?.totalStudents ?? 0;
  const currentPending = currentYearPending ?? summary?.pending ?? 0;
  const prevPending = previousYearPending ?? 0;
  const totalDue = totalPending ?? (currentPending + prevPending);

  const isGujarati = activeMedium === 'gujarati';
  const isEnglish = activeMedium === 'english';

  const mediumLabel = isGujarati
    ? t('gujaratiMediumSummary') || 'Gujarati Medium Summary'
    : isEnglish
    ? t('englishMediumSummary') || 'English Medium Summary'
    : 'Medium Summary';

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* Scope Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-border/70 text-xs">
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
        <span className="text-xs text-muted-foreground">
          Showing enrolled student & fee accounts for {isGujarati ? 'Gujarati' : isEnglish ? 'English' : 'all'} medium
        </span>
      </div>

      {/* 4 Focused Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 font-mono-nums">
        {/* 1. Students Count */}
        <div className="rounded-lg bg-muted/40 border border-border/60 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">
              {isGujarati ? 'Gujarati Students' : isEnglish ? 'English Students' : 'Students'}
            </span>
            <Users className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {count}
            </span>
            <span className="text-xs font-sans text-muted-foreground">enrolled</span>
          </div>
        </div>

        {/* 2. This Year Pending */}
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
            <span className="text-[11px] font-medium uppercase tracking-wider">
              This Year Pending
            </span>
            <IndianRupee className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {formatINR(currentPending)}
            </span>
          </div>
        </div>

        {/* 3. Previous Year Pending */}
        <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-orange-800 dark:text-orange-300">
            <span className="text-[11px] font-medium uppercase tracking-wider">
              Previous Year Pending
            </span>
            <Clock className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
              {formatINR(prevPending)}
            </span>
            {prevPending > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                Old Dues
              </span>
            )}
          </div>
        </div>

        {/* 4. Total Pending */}
        <div className="rounded-lg bg-rose-500/5 border border-rose-500/25 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-800 dark:text-rose-300">
            <span className="text-[11px] font-medium uppercase tracking-wider">
              Total Pending
            </span>
            <AlertCircle className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {formatINR(totalDue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
