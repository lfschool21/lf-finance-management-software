import React from 'react';
import { Users, ArrowRight, IndianRupee, Clock, CheckCircle2 } from 'lucide-react';
import { formatINR } from '@/utils/currency';
import type { ClassCardSummary } from '@/lib/student-fees';
import type { StudentMedium } from '@/types/students';

interface ClassCardProps {
  summary: ClassCardSummary;
  medium: StudentMedium;
  onSelectClass: (className: string) => void;
}

export function ClassCard({ summary, medium, onSelectClass }: ClassCardProps) {
  const {
    className,
    totalStudents,
    currentYearPending,
    previousYearPending,
    totalPending,
  } = summary;

  const isGujarati = medium === 'gujarati';
  const hasOldDues = previousYearPending > 0;
  const hasTotalPending = totalPending > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectClass(className)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectClass(className);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
        isGujarati
          ? 'hover:border-amber-500/50 hover:ring-1 hover:ring-amber-500/20'
          : 'hover:border-sky-500/50 hover:ring-1 hover:ring-sky-500/20'
      }`}
    >
      {/* Top Header: Class Name and Student Count */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-sans text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
              {className}
            </h3>
            <span
              className={`inline-block text-[11px] font-medium tracking-wide uppercase mt-0.5 ${
                isGujarati ? 'text-amber-700 dark:text-amber-300' : 'text-sky-700 dark:text-sky-300'
              }`}
            >
              {isGujarati ? 'Gujarati Medium' : 'English Medium'}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-1 text-xs font-medium text-foreground">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono-nums font-semibold">{totalStudents}</span>
          </div>
        </div>

        {/* Financial Metrics Grid */}
        <div className="mt-4 space-y-2.5 font-mono-nums text-xs">
          {/* 1. This Year Pending */}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <IndianRupee className="h-3.5 w-3.5 opacity-70" />
              This Year Pending
            </span>
            <span
              className={`font-semibold ${
                currentYearPending > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-income'
              }`}
            >
              {currentYearPending > 0 ? formatINR(currentYearPending) : '₹0'}
            </span>
          </div>

          {/* 2. Previous Year Pending */}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 opacity-70" />
              Previous Year Pending
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-semibold ${
                  hasOldDues
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-muted-foreground'
                }`}
              >
                {hasOldDues ? formatINR(previousYearPending) : '₹0'}
              </span>
              {hasOldDues ? (
                <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-300 uppercase tracking-wider">
                  Old Dues
                </span>
              ) : (
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  Clean
                </span>
              )}
            </div>
          </div>

          {/* 3. Total Pending */}
          <div className="flex items-center justify-between rounded-lg bg-rose-500/5 border border-rose-500/20 px-3 py-2 text-xs">
            <span className="font-semibold text-rose-900 dark:text-rose-200">
              Total Pending
            </span>
            <span className="font-bold text-sm text-rose-600 dark:text-rose-400">
              {hasTotalPending ? formatINR(totalPending) : '₹0'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
        <span className="text-[11px] text-muted-foreground">
          {hasTotalPending ? 'Pending collection required' : 'All accounts settled'}
        </span>
        <div className="flex items-center gap-1 font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
          <span>View Students</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
