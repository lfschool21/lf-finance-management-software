import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import type { Student, StudentEnrollment, StudentMedium } from '@/types/students';
import { parseNonNegativeAmount } from '@/lib/finance-domain';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';
import { Loader2, UserCheck } from 'lucide-react';

import { getPreviousClassName } from '@/utils/class-progression';

interface AddHistoricalFeeModalProps {
  open: boolean;
  onClose: () => void;
  student: Student;
  existingEnrollments: StudentEnrollment[];
  editingEnrollment?: StudentEnrollment | null;
}

export function AddHistoricalFeeModal({
  open,
  onClose,
  student,
  existingEnrollments,
  editingEnrollment,
}: AddHistoricalFeeModalProps) {
  const { academicYears, currentYearId } = useFinanceStore();
  const { saveStudent } = useStudentStore();

  const [yearId, setYearId] = useState('');
  const [amountLeft, setAmountLeft] = useState('');
  const [className, setClassName] = useState('');
  const [medium, setMedium] = useState<StudentMedium>('english');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Available academic years sorted by startDate descending (most recent past years first)
  const existingYearIds = useMemo(
    () =>
      new Set(
        existingEnrollments
          .filter((e) => !editingEnrollment || e.id !== editingEnrollment.id)
          .map((e) => e.academicYearId)
      ),
    [existingEnrollments, editingEnrollment]
  );

  const availableYears = useMemo(
    () =>
      academicYears
        .filter((y) => !existingYearIds.has(y.id))
        .sort((a, b) => {
          const timeA = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
          const timeB = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
          return timeB - timeA;
        }),
    [academicYears, existingYearIds]
  );

  const currentYear = useMemo(
    () => academicYears.find((y) => y.id === currentYearId),
    [academicYears, currentYearId]
  );

  const precedingYears = useMemo(
    () =>
      academicYears
        .filter((y) => {
          if (y.id === currentYearId) return false;
          if (currentYear) {
            const curStart = currentYear.startDate instanceof Date ? currentYear.startDate.getTime() : new Date(currentYear.startDate).getTime();
            const yStart = y.startDate instanceof Date ? y.startDate.getTime() : new Date(y.startDate).getTime();
            return yStart < curStart;
          }
          return true;
        })
        .sort((a, b) => {
          const timeA = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
          const timeB = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
          return timeB - timeA;
        }),
    [academicYears, currentYearId, currentYear]
  );

  useEffect(() => {
    if (!open) return;

    if (editingEnrollment) {
      setYearId(editingEnrollment.academicYearId);
      setAmountLeft(String(editingEnrollment.annualFeeAmount || ''));
      setClassName(editingEnrollment.className || '');
      setMedium(editingEnrollment.medium || 'english');
      setNotes(editingEnrollment.notes || '');
    } else {
      const autoYear = availableYears[0]?.id || precedingYears[0]?.id || academicYears.find((y) => y.id !== currentYearId)?.id || '';
      // Find current active enrollment or latest enrollment
      const currentEnrollment = existingEnrollments.find((e) => e.academicYearId === currentYearId) || existingEnrollments[0];
      const autoPreviousClass = getPreviousClassName(currentEnrollment?.className);
      const fallbackMedium = currentEnrollment?.medium || 'english';

      setYearId(autoYear);
      setAmountLeft('');
      setClassName(autoPreviousClass);
      setMedium(fallbackMedium);
      setNotes('');
    }
  }, [open, editingEnrollment]);

  async function handleSave() {
    const fee = parseNonNegativeAmount(amountLeft);

    const targetYearId = yearId || availableYears[0]?.id || precedingYears[0]?.id || academicYears.find((y) => y.id !== currentYearId)?.id;
    if (!targetYearId) {
      toast({ title: 'No previous academic year found in system', variant: 'destructive' });
      return;
    }
    if (!className.trim()) {
      toast({ title: 'Enter a previous class', variant: 'destructive' });
      return;
    }
    if (fee === null) {
      toast({ title: 'Enter a valid amount (₹)', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await saveStudent(
        {
          id: student.id,
          admission_number: student.admissionNumber || null,
          full_name: student.fullName,
          status: student.status,
          notes: student.notes || null,
        },
        {
          id: editingEnrollment?.id,
          academic_year_id: targetYearId,
          class_name: className.trim() || 'Previous Class',
          medium,
          annual_fee_amount: fee,
          additional_outstanding_amount: 0,
          opening_collected_cash: 0,
          opening_collected_upi: 0,
          opening_collected_other: 0,
          opening_snapshot_date: null,
          status: 'active',
          notes: notes.trim() || null,
        }
      );

      toast({
        title: editingEnrollment
          ? 'Previous-year fee record updated'
          : 'Previous-year fee record added',
        description: `Pending fee balance of ${formatINR(fee)} recorded.`,
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Failed to save previous-year fee',
        description: error instanceof Error ? error.message : 'Database error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const currentEnrollment = existingEnrollments.find((e) => e.academicYearId === currentYearId) || existingEnrollments[0];

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {editingEnrollment ? 'Edit Previous-Year Fee' : 'Add Previous-Year Fee'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter the unpaid fee amount left from the previous year. This directly records the student's previous-year pending balance.
          </DialogDescription>
        </DialogHeader>

        {/* Read-only Student Context Card */}
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2.5 text-xs">
          <UserCheck className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{student.fullName}</p>
            <p className="text-muted-foreground text-[11px]">
              Admission: {student.admissionNumber || '—'} · Current Class: {currentEnrollment?.className || '—'}
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs pt-1">
          {/* Previous Class */}
          <div>
            <Label htmlFor="hist-class" className="text-xs font-semibold text-foreground">
              Previous Class *
            </Label>
            <Input
              id="hist-class"
              type="text"
              placeholder="e.g. Class 4"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="mt-1 h-9 text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Inferred from current class. You can edit this if needed.
            </p>
          </div>

          {/* Previous-Year Pending Fee Amount (Primary Input) */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="hist-amount-left" className="text-xs font-semibold text-foreground">
                Previous-Year Pending Fee (₹) *
              </Label>
              {amountLeft && !isNaN(Number(amountLeft)) && (
                <span className="font-mono text-xs font-semibold text-warning font-mono-nums">
                  {formatINR(Number(amountLeft))}
                </span>
              )}
            </div>
            <Input
              id="hist-amount-left"
              aria-label="Pending Fee Left (₹)"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 5000"
              value={amountLeft}
              onChange={(e) => setAmountLeft(e.target.value)}
              className="mt-1 h-10 text-sm font-mono font-medium"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              Unpaid fee amount left to recover from last year.
            </p>
          </div>

          {/* Notes (Optional) */}
          <div>
            <Label htmlFor="hist-notes" className="text-xs text-muted-foreground">Notes (optional)</Label>
            <Textarea
              id="hist-notes"
              rows={2}
              placeholder="e.g. Unpaid balance carried forward"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-4 flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="text-xs gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{editingEnrollment ? 'Update Fee Record' : 'Save Fee Record'}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
