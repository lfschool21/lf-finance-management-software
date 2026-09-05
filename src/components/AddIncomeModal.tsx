import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';
import { Loader2, X, IndianRupee, UtensilsCrossed, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { IncomeDbType, IncomeEntry } from '@/types/finance';
import type { PaymentMethod } from '@/types/finance';
import { TUITION_CATEGORY, LUNCH_CATEGORY, OTHER_CATEGORY } from '@/types/finance';
import { getFeeOutstanding, isPreviousAcademicYear, parseDateOnly, parsePositiveAmount } from '@/lib/finance-domain';
import { useStudentStore } from '@/store/student-store';
import { getStudentFeeSummary } from '@/lib/student-fees';
import { MEDIUM_LABELS } from '@/types/students';

type IncomeType = 'tuition' | 'lunch' | 'other';

interface AddIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  editEntry?: IncomeEntry;
  presetLateYearId?: string;
  presetStudentEnrollmentId?: string;
}

function categoryToType(cat: string): IncomeType {
  if (cat === TUITION_CATEGORY) return 'tuition';
  if (cat === LUNCH_CATEGORY) return 'lunch';
  return 'other';
}

export function AddIncomeModal({ isOpen, onClose, editEntry, presetLateYearId, presetStudentEnrollmentId }: AddIncomeModalProps) {
  const { accounts, academicYears, incomeEntries, addIncome, updateIncome, deleteIncome, getYearForDate } = useFinanceStore();
  const { students, enrollments } = useStudentStore();

  const [incomeType, setIncomeType] = useState<IncomeType>('tuition');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState('');
  const [isLateCollection, setIsLateCollection] = useState(false);
  const [originalYearId, setOriginalYearId] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const isEdit = !!editEntry;
  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived || account.id === editEntry?.accountId),
    [accounts, editEntry?.accountId],
  );

  const detectedYear = useMemo(() => {
    if (!date) return undefined;
    return getYearForDate(parseDateOnly(date));
  }, [date, getYearForDate]);

  const academicYearId = detectedYear?.id || '';

  const pendingYears = useMemo(() => {
    if (!detectedYear) return [];
    return academicYears.filter((year) =>
      isPreviousAcademicYear(year, detectedYear) &&
      getFeeOutstanding(year, incomeEntries, editEntry?.id).remaining > 0,
    );
  }, [academicYears, detectedYear, editEntry?.id, incomeEntries]);

  const selectedOutstanding = useMemo(() => {
    const original = academicYears.find((year) => year.id === originalYearId);
    return original ? getFeeOutstanding(original, incomeEntries, editEntry?.id).remaining : 0;
  }, [academicYears, editEntry?.id, incomeEntries, originalYearId]);

  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const studentMatches = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (query.length < 2) return [];
    return students.filter((student) => student.status === 'active' &&
      (student.fullName.toLowerCase().includes(query) || student.admissionNumber.toLowerCase().includes(query))).slice(0, 8);
  }, [studentSearch, students]);
  const studentObligations = useMemo(() => {
    if (!selectedStudentId || !detectedYear) return [];
    return enrollments.filter((enrollment) => enrollment.studentId === selectedStudentId).flatMap((enrollment) => {
      const year = academicYears.find((candidate) => candidate.id === enrollment.academicYearId);
      if (!year || (year.id !== detectedYear.id && !isPreviousAcademicYear(year, detectedYear))) return [];
      const summary = getStudentFeeSummary(enrollment, incomeEntries, editEntry?.id);
      return summary.pending > 0 ? [{ enrollment, year, summary }] : [];
    }).sort((a, b) => b.year.startDate.getTime() - a.year.startDate.getTime());
  }, [academicYears, detectedYear, editEntry?.id, enrollments, incomeEntries, selectedStudentId]);
  const selectedStudentObligation = studentObligations.find((item) => item.enrollment.id === selectedEnrollmentId);

  useEffect(() => {
    if (isOpen) {
      if (editEntry) {
        setIncomeType(categoryToType(editEntry.category));
        setAmount(editEntry.amount.toString());
        setDate(editEntry.date.toISOString().split('T')[0]);
        setAccountId(editEntry.accountId);
        setIsLateCollection(editEntry.isLateCollection);
        setOriginalYearId(editEntry.originalYearId || '');
        const enrollment = enrollments.find((item) => item.id === editEntry.studentEnrollmentId);
        setSelectedEnrollmentId(editEntry.studentEnrollmentId || '');
        setSelectedStudentId(enrollment?.studentId || '');
        setPaymentMethod(editEntry.paymentMethod || 'cash');
        setPaymentReference(editEntry.paymentReference);
        setNotes(editEntry.notes);
        setTags(editEntry.tags);
      } else {
        setIncomeType('tuition');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setAccountId(activeAccounts[0]?.id || '');
        setIsLateCollection(!!presetLateYearId);
        setOriginalYearId(presetLateYearId || '');
        const presetEnrollment = enrollments.find((item) => item.id === presetStudentEnrollmentId);
        setSelectedEnrollmentId(presetStudentEnrollmentId || '');
        setSelectedStudentId(presetEnrollment?.studentId || '');
        setPaymentMethod('cash');
        setPaymentReference('');
        setStudentSearch('');
        setNotes('');
        setTags([]);
      }
      setErrors({});
      setTagInput('');
    }
  }, [isOpen, editEntry, presetLateYearId, presetStudentEnrollmentId, activeAccounts, enrollments]);

  useEffect(() => {
    if (!selectedEnrollmentId || !detectedYear) return;
    const enrollment = enrollments.find((item) => item.id === selectedEnrollmentId);
    if (!enrollment) return;
    const late = enrollment.academicYearId !== detectedYear.id;
    setIsLateCollection(late);
    setOriginalYearId(late ? enrollment.academicYearId : '');
  }, [detectedYear, enrollments, selectedEnrollmentId]);

  useEffect(() => {
    if (!accountId || incomeType !== 'tuition') return;
    const selected = accounts.find((account) => account.id === accountId);
    if (paymentMethod === 'cash' && selected?.type !== 'cash') {
      const cash = activeAccounts.find((account) => account.type === 'cash');
      if (cash) setAccountId(cash.id);
    } else if (paymentMethod === 'upi' && selected?.type === 'cash') {
      const bank = activeAccounts.find((account) => account.type !== 'cash');
      if (bank) setAccountId(bank.id);
    }
  }, [accountId, accounts, activeAccounts, incomeType, paymentMethod]);

  /** Returns the DB enum value for the selected income type */
  function resolvedCategory(): IncomeDbType {
    return incomeType; // 'tuition' | 'lunch' | 'other' — matches DB CHECK constraint
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const amt = parsePositiveAmount(amount);
    if (amt === null) errs.amount = 'Enter a finite amount greater than zero';
    if (!date) errs.date = 'Date is required';
    if (!accountId) errs.accountId = 'Select an account';
    if (incomeType === 'tuition' && selectedStudentId && !selectedEnrollmentId) errs.studentEnrollmentId = 'Select which fee balance this payment applies to';
    if (selectedEnrollmentId && !selectedStudentObligation) errs.studentEnrollmentId = 'Select an outstanding fee balance';
    if (selectedStudentObligation && amt !== null && amt > selectedStudentObligation.summary.pending) {
      errs.amount = `Amount cannot exceed this student's remaining ${formatINR(selectedStudentObligation.summary.pending)}`;
    }
    if (isLateCollection && !originalYearId) errs.originalYearId = 'Select the original year';
    if (!academicYearId) errs.year = 'No academic year found for this date';
    if (isLateCollection && originalYearId && !pendingYears.some((year) => year.id === originalYearId)) {
      errs.originalYearId = 'Select a preceding year with an outstanding balance';
    }
    if (isLateCollection && amt !== null && amt > selectedOutstanding) {
      errs.amount = `Amount cannot exceed the remaining ${formatINR(selectedOutstanding)}`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function addTag() {
    const newTags = tagInput.split(',').map((t) => t.trim()).filter((t) => t && !tags.includes(t));
    if (newTags.length) setTags([...tags, ...newTags]);
    setTagInput('');
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        type: resolvedCategory(),
        amount: parsePositiveAmount(amount)!,
        date,
        academic_year_id: academicYearId,
        account_id: accountId,
        is_late_collection: incomeType === 'tuition' ? isLateCollection : false,
        original_year_id: incomeType === 'tuition' && isLateCollection ? originalYearId : null,
        student_enrollment_id: incomeType === 'tuition' && selectedEnrollmentId ? selectedEnrollmentId : null,
        payment_method: incomeType === 'tuition' ? paymentMethod : null,
        payment_reference: incomeType === 'tuition' && paymentReference.trim() ? paymentReference.trim() : null,
        notes: notes || null,
        tags: tags.length > 0 ? tags : null,
      };

      if (isEdit && editEntry) {
        await updateIncome(editEntry.id, payload);
        toast({ title: '✅ Income updated' });
      } else {
        await addIncome(payload);
        toast({ title: '✅ Income recorded' });
      }
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editEntry) return;
    setSaving(true);
    try {
      await deleteIncome(editEntry.id);
      toast({ title: 'Income entry deleted' });
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Income' : 'Add Income'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            {/* Income Type — 3 toggle boxes */}
            <div>
              <Label className="mb-2 block text-sm">Income Type</Label>
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
                {(
                  [
                    { key: 'tuition', label: 'Tuition Fees', icon: IndianRupee },
                    { key: 'lunch',   label: 'Lunch Fees',   icon: UtensilsCrossed },
                    { key: 'other',   label: 'Investment / Extra', icon: PlusCircle },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIncomeType(key)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-3 text-xs font-semibold transition-all',
                      incomeType === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {incomeType === 'tuition' && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div><Label>Student</Label><p className="text-xs text-muted-foreground">Preferred for individual fee tracking</p></div>
                  {selectedStudent && <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedStudentId(''); setSelectedEnrollmentId(''); }}>Clear</Button>}
                </div>
                {!selectedStudent ? <>
                  <Input aria-label="Search student" placeholder="Search name or admission number..." value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} />
                  {studentMatches.length > 0 && <div className="max-h-44 divide-y overflow-auto rounded-md border bg-card">{studentMatches.map((student) => {
                    const current = enrollments.find((item) => item.studentId === student.id && item.academicYearId === academicYearId);
                    return <button type="button" key={student.id} className="flex w-full items-center justify-between gap-3 p-2.5 text-left hover:bg-muted" onClick={() => { setSelectedStudentId(student.id); setStudentSearch(''); setSelectedEnrollmentId(''); }}><span><span className="block text-sm font-medium">{student.fullName}</span><span className="block text-xs text-muted-foreground">{student.admissionNumber || 'No admission number'}{current ? ` · ${current.className} · ${MEDIUM_LABELS[current.medium]}` : ''}</span></span></button>;
                  })}</div>}
                  <div className="rounded-md border border-warning/30 bg-warning/5 p-2 text-xs text-muted-foreground"><strong className="text-foreground">Record without student:</strong> this updates school finances but will not reduce an individual student's balance.</div>
                </> : <>
                  <div className="rounded-md bg-card p-2"><p className="font-medium">{selectedStudent.fullName}</p><p className="text-xs text-muted-foreground">{selectedStudent.admissionNumber || 'No admission number'}</p></div>
                  <div><Label>Apply To</Label><Select value={selectedEnrollmentId} onValueChange={setSelectedEnrollmentId}><SelectTrigger><SelectValue placeholder="Select fee balance" /></SelectTrigger><SelectContent>{studentObligations.map(({ enrollment, year, summary }) => <SelectItem key={enrollment.id} value={enrollment.id}>{year.id === academicYearId ? 'Current-Year Fee' : `AY ${year.label} Previous-Year Fee`} — {formatINR(summary.pending)}</SelectItem>)}</SelectContent></Select>{errors.studentEnrollmentId && <p className="mt-1 text-xs text-destructive">{errors.studentEnrollmentId}</p>}</div>
                  {selectedStudentObligation && <div className="grid grid-cols-2 gap-2 rounded-md bg-primary/5 p-2 text-xs"><span>{selectedStudentObligation.enrollment.className} · {MEDIUM_LABELS[selectedStudentObligation.enrollment.medium]}</span><span className="text-right font-mono font-semibold">{formatINR(selectedStudentObligation.summary.pending)} pending</span></div>}
                </>}
              </div>
            )}

            {/* Amount */}
            <div>
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount && parseFloat(amount) > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{formatINR(parseFloat(amount))}</p>
              )}
              {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
            </div>

            {/* Date */}
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              {detectedYear && (
                <p className="mt-1 text-xs text-muted-foreground">Academic Year: {detectedYear.label}</p>
              )}
              {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
              {errors.year && <p className="mt-1 text-xs text-destructive">{errors.year}</p>}
            </div>

            {/* Account */}
            {incomeType === 'tuition' && <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2"><div><Label>Payment Method</Label><Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div><Label htmlFor="payment-reference">Reference (optional)</Label><Input id="payment-reference" maxLength={200} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="UPI / cheque / receipt" /></div></div>}

            <div>
              <Label>Received In</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.isArchived ? ' (Archived)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountId && <p className="mt-1 text-xs text-destructive">{errors.accountId}</p>}
            </div>

            {/* Previous-year payment — only for Tuition Fees */}
            {incomeType === 'tuition' && !selectedEnrollmentId && (
              <>
                <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div>
                    <p className="text-sm font-medium">Previous-Year Fee Payment</p>
                    <p className="text-xs text-muted-foreground">Payment received now for an older academic year</p>
                  </div>
                  <Switch
                    checked={isLateCollection}
                    onCheckedChange={setIsLateCollection}
                    disabled={pendingYears.length === 0 && !isLateCollection}
                    aria-label="Previous-Year Fee Payment"
                  />
                </div>

                {pendingYears.length === 0 && !isLateCollection && (
                  <div className="rounded-lg border border-dashed p-3 text-sm">
                    <p className="font-medium">No previous-year fee balance is currently pending.</p>
                    <Button
                      type="button"
                      variant="link"
                      className="mt-1 h-auto px-0 text-xs"
                      onClick={() => { onClose(); navigate('/income'); }}
                    >
                      Manage Previous-Year Fees Pending →
                    </Button>
                  </div>
                )}

                {isLateCollection && (
                  <div>
                    <Label>Original Academic Year</Label>
                    <Select value={originalYearId} onValueChange={setOriginalYearId}>
                      <SelectTrigger><SelectValue placeholder="Select original year" /></SelectTrigger>
                      <SelectContent>
                        {pendingYears.map((y) => (
                          <SelectItem key={y.id} value={y.id}>
                            AY {y.label} — {formatINR(getFeeOutstanding(y, incomeEntries, editEntry?.id).remaining)} pending
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.originalYearId && <p className="mt-1 text-xs text-destructive">{errors.originalYearId}</p>}
                    {originalYearId && !errors.originalYearId && (
                      <div className="mt-2 rounded-md bg-warning/10 p-2 text-xs">
                        <p className="text-muted-foreground">Remaining before this payment</p>
                        <p className="font-mono font-semibold text-warning">{formatINR(selectedOutstanding)}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" placeholder="Add any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {/* Tags */}
            <div>
              <Label>Tags (optional)</Label>
              <div className="flex flex-col gap-2 min-[360px]:flex-row">
                <Input
                  placeholder="Add tags, comma separated"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" size="sm" variant="outline" onClick={addTag}>Add</Button>
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="max-w-full gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter((t) => t !== tag))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-center">
              {isEdit && (
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={saving} className="col-span-2 sm:col-span-1">
                  Delete
                </Button>
              )}
              <div className="hidden flex-1 sm:block" />
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-income text-income-foreground hover:bg-income/90">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Update' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Income Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this income entry of {editEntry ? formatINR(editEntry.amount) : ''}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
