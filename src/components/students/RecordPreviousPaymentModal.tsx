import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import type { Student, StudentEnrollment } from '@/types/students';
import type { PaymentMethod } from '@/types/finance';
import { getFeeCollected, parseDateOnly, parsePositiveAmount } from '@/lib/finance-domain';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';
import { Loader2, Banknote, Smartphone, Check, Building2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as academicYearsService from '@/services/academicYears';
import { getAcademicYearDates } from '@/utils/academic-year';

interface RecordPreviousPaymentModalProps {
  open: boolean;
  onClose: () => void;
  student: Student;
  previousEnrollment: StudentEnrollment;
  previousPending: number;
  previousClass?: string;
  previousObligation?: number;
  previousRecovered?: number;
}

export function RecordPreviousPaymentModal({
  open,
  onClose,
  student,
  previousEnrollment,
  previousPending,
  previousClass,
  previousObligation,
  previousRecovered,
}: RecordPreviousPaymentModalProps) {
  const {
    accounts,
    academicYears,
    currentYearId,
    incomeEntries,
    addIncome,
    getYearForDate,
    refreshAcademicYears,
  } = useFinanceStore();
  const { enrollments, saveStudent } = useStudentStore();

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.isArchived),
    [accounts]
  );

  const cashAccounts = useMemo(
    () => activeAccounts.filter((a) => a.type === 'cash'),
    [activeAccounts]
  );

  const bankAccounts = useMemo(
    () => activeAccounts.filter((a) => a.type !== 'cash'),
    [activeAccounts]
  );

  const displayClass = previousClass || previousEnrollment.className || 'Previous Class';

  // Set defaults when modal opens, clamping date within active academic year if needed
  useEffect(() => {
    if (!open) return;

    const targetYear =
      academicYears.find((y) => y.id === currentYearId) ||
      academicYears.find((y) => y.status === 'active') ||
      academicYears[0];

    let initialDate = new Date().toISOString().split('T')[0];
    if (targetYear) {
      const today = parseDateOnly(initialDate);
      const start =
        targetYear.startDate instanceof Date
          ? targetYear.startDate
          : new Date(targetYear.startDate);
      const end =
        targetYear.endDate instanceof Date
          ? targetYear.endDate
          : new Date(targetYear.endDate);
      if (today < start) {
        initialDate =
          targetYear.startDate instanceof Date
            ? targetYear.startDate.toISOString().split('T')[0]
            : String(targetYear.startDate);
      } else if (today > end) {
        const todayYear = getYearForDate ? getYearForDate(today) : null;
        if (!todayYear) {
          initialDate =
            targetYear.endDate instanceof Date
              ? targetYear.endDate.toISOString().split('T')[0]
              : String(targetYear.endDate);
        }
      }
    }

    setDate(initialDate);
    setAmount('');
    setPaymentReference('');
    setError(null);
    setPaymentMethod('cash');
    setAccountId(cashAccounts[0]?.id || activeAccounts[0]?.id || '');
  }, [open, currentYearId, academicYears, getYearForDate, cashAccounts, activeAccounts]);

  function handleMethodSelect(method: PaymentMethod) {
    setPaymentMethod(method);
    setError(null);
    if (method === 'cash') {
      setAccountId(cashAccounts[0]?.id || activeAccounts[0]?.id || '');
    } else if (method === 'upi') {
      setAccountId(bankAccounts[0]?.id || activeAccounts[0]?.id || '');
    }
  }

  async function handleSave() {
    setError(null);
    const parsedAmount = parsePositiveAmount(amount);

    if (parsedAmount === null) {
      setError('Enter a valid payment amount greater than zero');
      return;
    }

    if (previousPending > 0 && parsedAmount > previousPending) {
      setError(
        `Payment cannot exceed remaining previous-year balance of ${formatINR(previousPending)}`
      );
      return;
    }

    if (!accountId) {
      setError('Please select a destination account');
      return;
    }

    setSaving(true);
    try {
      // 1. Determine booking academic year (accounting year receiving the payment)
      const paymentDateObj = date ? parseDateOnly(date) : new Date();
      const dateYear = getYearForDate ? getYearForDate(paymentDateObj) : null;
      const bookingYear =
        dateYear ||
        academicYears.find((y) => y.id === currentYearId) ||
        academicYears.find((y) => y.status === 'active') ||
        academicYears[0];

      if (!bookingYear) {
        setError('No active academic year found in system');
        return;
      }
      const bookingYearId = bookingYear.id;

      // 2. Determine target academic year (preceding academic year being settled)
      const bookingStartTime =
        bookingYear.startDate instanceof Date
          ? bookingYear.startDate.getTime()
          : new Date(bookingYear.startDate).getTime();

      const precedingYears = academicYears
        .filter((y) => {
          if (y.id === bookingYearId) return false;
          const yStart =
            y.startDate instanceof Date ? y.startDate.getTime() : new Date(y.startDate).getTime();
          return yStart < bookingStartTime;
        })
        .sort((a, b) => {
          const timeA =
            a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
          const timeB =
            b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
          return timeB - timeA;
        });

      let targetYearId =
        previousEnrollment.academicYearId &&
        precedingYears.some((y) => y.id === previousEnrollment.academicYearId)
          ? previousEnrollment.academicYearId
          : precedingYears[0]?.id;

      // If no preceding academic year exists in the system at all, create one (e.g. 2025-26)
      if (!targetYearId) {
        try {
          const curStartYear =
            parseInt(bookingYear.label.split('-')[0]) ||
            (bookingYear.startDate instanceof Date
              ? bookingYear.startDate.getFullYear()
              : new Date(bookingYear.startDate).getFullYear());
          const prevLabel = `${curStartYear - 1}-${String(curStartYear).slice(2)}`;
          const { start, end } = getAcademicYearDates(prevLabel);
          const obligationAmount = Math.max(previousObligation || 0, previousPending || 0, parsedAmount);
          const { data: createdYear, error: createYearErr } = await academicYearsService.create({
            label: prevLabel,
            start_date: start.toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0],
            target_tuition_fees: obligationAmount,
            carry_forward_fees: 0,
            status: 'closed',
          });
          if (createYearErr || !createdYear) {
            throw createYearErr || new Error('Could not create preceding academic year');
          }
          if (refreshAcademicYears) {
            await refreshAcademicYears();
          }
          targetYearId = createdYear.id;
        } catch (createErr) {
          throw new Error(
            createErr instanceof Error
              ? createErr.message
              : 'No preceding academic year found to attribute previous fee to.'
          );
        }
      }

      // 3. Resolve or create a real historical enrollment for student in targetYearId
      const allEnrollments = useStudentStore.getState().enrollments;
      const currentEnrollment = allEnrollments.find(
        (e) =>
          e.studentId === student.id &&
          (e.academicYearId === bookingYearId || e.academicYearId === currentYearId)
      );

      // Check if student already has a genuine enrollment for targetYearId (that is not the current enrollment)
      let targetEnrollment = allEnrollments.find(
        (e) =>
          e.studentId === student.id &&
          e.academicYearId === targetYearId &&
          (!currentEnrollment || e.id !== currentEnrollment.id)
      );

      const obligationAmount = Math.max(previousObligation || 0, previousPending || 0, parsedAmount);

      if (!targetEnrollment) {
        // Create real historical enrollment in targetYearId so database attribution trigger passes
        await saveStudent(
          {
            id: student.id,
            admission_number: student.admissionNumber || null,
            full_name: student.fullName,
            status: student.status,
            notes: student.notes || null,
          },
          {
            academic_year_id: targetYearId,
            class_name: displayClass,
            medium: currentEnrollment?.medium || previousEnrollment.medium || 'english',
            annual_fee_amount: obligationAmount,
            additional_outstanding_amount: 0,
            opening_collected_cash: 0,
            opening_collected_upi: 0,
            opening_collected_other: 0,
            opening_snapshot_date: null,
            status: 'active',
            notes: 'Carried forward from last year',
          }
        );

        const updatedEnrollments = useStudentStore.getState().enrollments;
        targetEnrollment = updatedEnrollments.find(
          (e) =>
            e.studentId === student.id &&
            e.academicYearId === targetYearId &&
            (!currentEnrollment || e.id !== currentEnrollment.id)
        );

        if (!targetEnrollment) {
          throw new Error('Failed to resolve historical enrollment record');
        }

        // If current enrollment had additionalOutstandingAmount, clear it since it's now tracked in historical enrollment
        if (currentEnrollment && currentEnrollment.additionalOutstandingAmount > 0) {
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
                id: currentEnrollment.id,
                academic_year_id: currentEnrollment.academicYearId,
                class_name: currentEnrollment.className,
                medium: currentEnrollment.medium,
                annual_fee_amount: currentEnrollment.annualFeeAmount,
                additional_outstanding_amount: 0,
                opening_collected_cash: currentEnrollment.openingCollectedCash,
                opening_collected_upi: currentEnrollment.openingCollectedUpi,
                opening_collected_other: currentEnrollment.openingCollectedOther,
                opening_snapshot_date: currentEnrollment.openingSnapshotDate,
                status: currentEnrollment.status,
                notes: currentEnrollment.notes || null,
              }
            );
          } catch (syncErr) {
            console.warn('Could not reset current enrollment additionalOutstandingAmount:', syncErr);
          }
        }
      } else {
        // Target enrollment exists - ensure total fee ceiling can cover this payment
        const existingPaid =
          incomeEntries
            .filter((i) => i.studentEnrollmentId === targetEnrollment!.id)
            .reduce((sum, i) => sum + i.amount, 0) +
          (targetEnrollment.openingCollectedCash || 0) +
          (targetEnrollment.openingCollectedUpi || 0) +
          (targetEnrollment.openingCollectedOther || 0);

        const minRequired = existingPaid + parsedAmount;
        const totalFee =
          (targetEnrollment.annualFeeAmount || 0) +
          (targetEnrollment.additionalOutstandingAmount || 0);

        if (totalFee < minRequired) {
          await saveStudent(
            {
              id: student.id,
              admission_number: student.admissionNumber || null,
              full_name: student.fullName,
              status: student.status,
              notes: student.notes || null,
            },
            {
              id: targetEnrollment.id,
              academic_year_id: targetEnrollment.academicYearId,
              class_name: targetEnrollment.className,
              medium: targetEnrollment.medium,
              annual_fee_amount: minRequired,
              additional_outstanding_amount: targetEnrollment.additionalOutstandingAmount || 0,
              opening_collected_cash: targetEnrollment.openingCollectedCash || 0,
              opening_collected_upi: targetEnrollment.openingCollectedUpi || 0,
              opening_collected_other: targetEnrollment.openingCollectedOther || 0,
              opening_snapshot_date: targetEnrollment.openingSnapshotDate || null,
              status: targetEnrollment.status,
              notes: targetEnrollment.notes || null,
            }
          );
        }
      }

      // 4. Auto-sync target academic year target_tuition_fees ceiling
      const oblYear = academicYears.find((y) => y.id === targetYearId);
      if (oblYear) {
        const currentPaid = getFeeCollected(incomeEntries, oblYear.id);
        const latestEnrollments = useStudentStore.getState().enrollments;
        const studentTotal = latestEnrollments
          .filter((e) => e.academicYearId === targetYearId)
          .reduce(
            (sum, e) =>
              sum + (e.annualFeeAmount || 0) + (e.additionalOutstandingAmount || 0),
            0
          );
        const needed = Math.max(studentTotal, currentPaid + parsedAmount);
        if (oblYear.targetTuitionFees < needed) {
          try {
            await academicYearsService.update(oblYear.id, { target_tuition_fees: needed });
            if (refreshAcademicYears) {
              await refreshAcademicYears();
            }
          } catch (syncErr) {
            console.warn('Could not auto-sync academic year target fees:', syncErr);
          }
        }
      }

      // 5. Add income transaction with strict accounting separation
      await addIncome({
        type: 'tuition',
        amount: parsedAmount,
        date,
        academic_year_id: bookingYearId,
        account_id: accountId,
        is_late_collection: true,
        original_year_id: targetYearId,
        student_enrollment_id: targetEnrollment.id,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || null,
        notes: `Previous-Year Fee Payment — ${displayClass}`,
        tags: [],
      });

      toast({
        title: 'Previous-year payment recorded',
        description: `${formatINR(parsedAmount)} received against ${displayClass} pending balance.`,
      });
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to record payment';
      setError(msg);
      toast({
        title: 'Failed to record payment',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const totalDue = previousObligation ?? previousEnrollment.annualFeeAmount ?? previousPending;
  const paidSoFar = previousRecovered ?? Math.max(0, totalDue - previousPending);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            Record Previous-Year Payment
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Collect payment against this student's unpaid dues from a previous academic year.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Context at top: Student, Previous Class, and 3 Separate Stat Boxes (Amber Theme) */}
        <div className="rounded-xl border bg-amber-500/10 border-amber-500/20 p-3.5 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Student</span>
              <p className="font-bold text-foreground text-sm leading-tight">{student.fullName}</p>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Previous Class</span>
              <p className="font-semibold text-foreground text-xs leading-tight">
                {displayClass}
              </p>
            </div>
          </div>

          {/* 3 Separate Stat Boxes: Original Due, Paid So Far, Pending Due */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-500/20">
            <div className="rounded-lg border bg-card/80 dark:bg-card/50 p-2.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Original Due
              </span>
              <span className="font-mono text-sm sm:text-base font-bold text-foreground mt-0.5 block font-mono-nums truncate">
                {formatINR(totalDue)}
              </span>
            </div>

            <div className="rounded-lg border bg-card/80 dark:bg-card/50 p-2.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Paid So Far
              </span>
              <span className="font-mono text-sm sm:text-base font-bold text-income mt-0.5 block font-mono-nums truncate">
                {formatINR(paidSoFar)}
              </span>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/15 dark:bg-amber-500/25 p-2.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                Pending Due
              </span>
              <span className="font-mono text-sm sm:text-base font-bold text-amber-700 dark:text-amber-400 mt-0.5 block font-mono-nums truncate">
                {formatINR(previousPending)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-xs pt-1">
          {/* 2. Payment Amount */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="prev-payment-amount" className="text-xs font-semibold text-foreground">
                Payment Amount (₹) *
              </Label>
              {previousPending > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAmount(String(previousPending));
                    setError(null);
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Pay Full Pending ({formatINR(previousPending)})
                </button>
              )}
            </div>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                ₹
              </span>
              <Input
                id="prev-payment-amount"
                type="number"
                min="1"
                max={previousPending}
                step="any"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="pl-7 h-10 text-base font-mono font-bold"
                autoFocus
              />
            </div>
            {amount && !isNaN(Number(amount)) && (
              <p className="mt-1 text-[11px] text-muted-foreground font-mono font-mono-nums">
                {formatINR(Number(amount))}
              </p>
            )}
          </div>

          {/* 3. Payment Method: Simple large selectable options (Cash / UPI) */}
          <div>
            <Label className="text-xs font-semibold text-foreground block mb-1.5">
              Payment Method *
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleMethodSelect('cash')}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all',
                  paymentMethod === 'cash'
                    ? 'border-emerald-600 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold ring-1 ring-emerald-500/30'
                    : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                )}
              >
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs">Cash</span>
                </div>
                {paymentMethod === 'cash' && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => handleMethodSelect('upi')}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all',
                  paymentMethod === 'upi'
                    ? 'border-sky-600 bg-sky-500/10 text-sky-800 dark:text-sky-300 font-semibold ring-1 ring-sky-500/30'
                    : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                )}
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs">UPI</span>
                </div>
                {paymentMethod === 'upi' && <Check className="h-4 w-4 text-sky-600 shrink-0" />}
              </button>
            </div>
          </div>

          {/* 4. Received In: Ask which account received the money */}
          <div>
            <Label htmlFor="prev-payment-account" className="text-xs font-semibold text-foreground block mb-1">
              {paymentMethod === 'upi' ? 'Received In / UPI Account *' : 'Received In *'}
            </Label>

            {paymentMethod === 'cash' ? (
              cashAccounts.length === 1 ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">{cashAccounts[0].name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-medium bg-muted px-1.5 py-0.5 rounded">
                    Cash Account
                  </span>
                </div>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="prev-payment-account" className="h-9 text-xs">
                    <SelectValue placeholder="Select cash account" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cashAccounts.length > 0 ? cashAccounts : activeAccounts).map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            ) : (
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="prev-payment-account" className="h-9 text-xs">
                  <SelectValue placeholder="Select bank / UPI account" />
                </SelectTrigger>
                <SelectContent>
                  {(bankAccounts.length > 0 ? bankAccounts : activeAccounts).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} className="text-xs">
                      {acc.name} · {acc.type === 'school_bank' ? 'School Bank / UPI' : 'Bank / UPI'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 5. Payment Date */}
          <div>
            <Label htmlFor="prev-payment-date" className="text-xs font-semibold text-foreground">
              Payment Date *
            </Label>
            <Input
              id="prev-payment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-9 text-xs"
            />
          </div>

          {/* 6. UPI Reference or Notes (Optional) */}
          {paymentMethod === 'upi' && (
            <div>
              <Label htmlFor="prev-payment-ref" className="text-xs text-muted-foreground">
                UPI Reference / UTR (optional)
              </Label>
              <Input
                id="prev-payment-ref"
                type="text"
                placeholder="e.g. 12-digit UPI reference ID"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="mt-1 h-9 text-xs font-mono"
              />
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="mt-4 flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || previousPending <= 0}
            className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 font-semibold"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Record Previous-Year Payment</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
