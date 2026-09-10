import React from 'react';
import { IndianRupee, ChevronRight, AlertCircle } from 'lucide-react';
import { StudentFeeBadge } from './StudentFeeBadge';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/utils/currency';
import type { StudentMedium } from '@/types/students';
import { StudentMediumBadge } from './StudentMediumBadge';
import type { StudentRowData } from './StudentTable';

interface StudentMobileCardProps {
  row: StudentRowData;
  onSelectStudent: (studentId: string) => void;
  onRecordPayment: (enrollmentId: string) => void;
  activeMedium?: 'all' | StudentMedium;
}

export function StudentMobileCard({
  row,
  onSelectStudent,
  onRecordPayment,
  activeMedium = 'all',
}: StudentMobileCardProps) {
  const { student, enrollment, fees, previous } = row;

  return (
    <div
      onClick={() => onSelectStudent(student.id)}
      className="group rounded-xl border bg-card p-3.5 shadow-sm transition-all hover:border-primary/40 active:scale-[0.99] cursor-pointer space-y-2.5"
    >
      {/* Header: Student Name + Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {student.fullName}
            </p>
            {activeMedium === 'all' && (
              <StudentMediumBadge medium={enrollment.medium} size="xs" variant="compact" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {student.admissionNumber ? `Adm. ${student.admissionNumber} · ` : ''}
            {enrollment.className}
          </p>
        </div>
        <StudentFeeBadge status={fees.status} size="sm" />
      </div>

      {/* Fee Metrics: Total | Collected | Pending */}
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/30 p-2 text-xs font-mono-nums">
        <div>
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
          <span className="font-mono font-medium text-foreground">{formatINR(fees.obligation)}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Paid</span>
          <span className="font-mono font-medium text-income">
            {fees.collected > 0 ? formatINR(fees.collected) : '₹0'}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Pending</span>
          <span className={`font-mono font-bold ${fees.pending > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
            {fees.pending > 0 ? formatINR(fees.pending) : '—'}
          </span>
        </div>
      </div>

      {/* Last Year's Pending Fee Warning if any */}
      {previous > 0 && (
        <div className="flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>Last year's pending: {formatINR(previous)}</span>
        </div>
      )}

      {/* Bottom quick actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1 group-hover:text-foreground">
          View details <ChevronRight className="h-3 w-3" />
        </span>

        {fees.pending > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 px-2.5 hover:bg-income/10 hover:text-income hover:border-income/30"
            onClick={(e) => {
              e.stopPropagation();
              onRecordPayment(enrollment.id);
            }}
          >
            <IndianRupee className="h-3 w-3" />
            <span>Pay Fee</span>
          </Button>
        )}
      </div>
    </div>
  );
}
