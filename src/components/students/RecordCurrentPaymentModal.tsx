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

interface RecordCurrentPaymentModalProps {
  open: boolean;
  onClose: () => void;
  student: Student;
  enrollment: StudentEnrollment;
  currentPending: number;
  currentFee?: number;
  currentPaid?: number;
}

export function RecordCurrentPaymentModal({
  open,
  onClose,
  student,
  enrollment,
  currentPending,
  currentFee,
  currentPaid,
}: RecordCurrentPaymentModalProps) {
  const {
    accounts,
    currentYearId,
    academicYears,
    incomeEntries,
    addIncome,
    getYearForDate,
    refreshAcademicYears,
  } = useFinanceStore();
  const { enrollments } = useStudentStore();

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

  const enrollmentYear = useMemo(() => {
    return academicYears.find((y) => y.id === enrollment.academicYearId);
  }, [academicYears, enrollment.academicYearId]);

  const yearLabel = enrollmentYear?.label || 'Current Session';

  // Set defaults when modal opens, clamping date within active academic year if needed
  useEffect(() => {
    if (!open) return;

    const targetYear =
      academicYears.find((y) => y.id === (enrollment.academicYearId || currentYearId)) ||
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
  }, [open, enrollment.academicYearId, currentYearId, academicYears, getYearForDate, cashAccounts, activeAccounts]);

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

    if (currentPending > 0 && parsedAmount > currentPending) {
      setError(
        `Payment cannot exceed remaining current-year balance of ${formatINR(currentPending)}`
      );
      return;
    }

    if (!accountId) {
      setError('Please select a destination account');
      return;
    }

    // Determine booking academic year
    const paymentDateObj = date ? parseDateOnly(date) : new Date();
    const dateYear = getYearForDate ? getYearForDate(paymentDateObj) : null;
    const targetYearId = enrollment.academicYearId || dateYear?.id || currentYearId;
    if (!targetYearId) {
      setError('No active academic year found in system');
      return;
    }

    setSaving(true);
    try {
      // Auto-sync academic year target_tuition_fees if needed
      const oblYear = academicYears.find((y) => y.id === targetYearId);
      if (oblYear) {
        const currentPaidAmt = getFeeCollected(incomeEntries, oblYear.id);
        const studentTotal = enrollments
          .filter((e) => e.academicYearId === targetYearId)
          .reduce(
            (sum, e) =>
              sum + (e.annualFeeAmount || 0) + (e.additionalOutstandingAmount || 0),
            0
          );
        const needed = Math.max(studentTotal, currentPaidAmt + parsedAmount);
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

      await addIncome({
        type: 'tuition',
        amount: parsedAmount,
        date,
        academic_year_id: targetYearId,
        account_id: accountId,
        is_late_collection: false,
        original_year_id: null,
        student_enrollment_id: enrollment.id,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || null,
        notes: `Current-Year Fee Payment — Class ${enrollment.className}`,
        tags: [],
      });

      toast({
        title: 'Current-year payment recorded',
        description: `${formatINR(parsedAmount)} collected for ${student.fullName} (Class ${enrollment.className}).`,
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

  const totalFee = currentFee ?? enrollment.annualFeeAmount ?? 0;
  const paidSoFar = currentPaid ?? Math.max(0, totalFee - currentPending);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            Record Current-Year Payment
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Collect tuition fee payment for Academic Year {yearLabel}.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Context at top: Student, Current Class, and 3 Separate Stat Boxes */}
        <div className="rounded-xl border bg-primary/10 border-primary/20 p-3.5 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Student</span>
              <p className="font-bold text-foreground text-sm leading-tight">{student.fullName}</p>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Class & Year</span>
              <p className="font-semibold text-foreground text-xs leading-tight">
                Class {enrollment.className} · AY {yearLabel}
              </p>
            </div>
          </div>

          {/* 3 Separate Stat Boxes: Total Fee, Paid So Far, Pending Due */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-primary/20">
            <div className="rounded-lg border bg-card/80 dark:bg-card/50 p-2.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Total Fee
              </span>
              <span className="font-mono text-sm sm:text-base font-bold text-foreground mt-0.5 block font-mono-nums truncate">
                {formatINR(totalFee)}
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

            <div className="rounded-lg border border-primary/30 bg-primary/15 dark:bg-primary/25 p-2.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                Pending Due
              </span>
              <span className="font-mono text-sm sm:text-base font-bold text-primary mt-0.5 block font-mono-nums truncate">
                {formatINR(currentPending)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-xs pt-1">
          {/* 2. Payment Amount */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="current-payment-amount" className="text-xs font-semibold text-foreground">
                Payment Amount (₹) *
              </Label>
              {currentPending > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAmount(String(currentPending));
                    setError(null);
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Pay Full Pending ({formatINR(currentPending)})
                </button>
              )}
            </div>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                ₹
              </span>
              <Input
                id="current-payment-amount"
                type="number"
                min="1"
                max={currentPending > 0 ? currentPending : undefined}
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
            <Label htmlFor="current-payment-account" className="text-xs font-semibold text-foreground block mb-1">
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
                  <SelectTrigger id="current-payment-account" className="h-9 text-xs">
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
                <SelectTrigger id="current-payment-account" className="h-9 text-xs">
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
            <Label htmlFor="current-payment-date" className="text-xs font-semibold text-foreground">
              Payment Date *
            </Label>
            <Input
              id="current-payment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-9 text-xs"
            />
          </div>

          {/* 6. UPI Reference or Notes (Optional) */}
          {paymentMethod === 'upi' && (
            <div>
              <Label htmlFor="current-payment-ref" className="text-xs text-muted-foreground">
                UPI Reference / UTR (optional)
              </Label>
              <Input
                id="current-payment-ref"
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

        {/* Modal Actions: Primary Blue Button */}
        <div className="mt-4 flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || currentPending <= 0}
            className="text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span className="sr-only">Save </span>
            <span>Record Current-Year Payment</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
